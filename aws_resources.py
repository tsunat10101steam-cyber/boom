"""AWS 리소스 스캔 / 삭제 로직.

각 스캐너는 아래 형태의 dict 리스트를 반환한다.
    {key, type, region, id, name, state, detail, protected, extra}
`extra` 는 삭제 시 필요한 내부 정보로, 프론트엔드에는 보내지 않는다.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

BOTO_CFG = Config(retries={"max_attempts": 6, "mode": "standard"},
                  connect_timeout=5, read_timeout=30)
# 조회용: 응답 없는 리전에서 오래 매달리지 않도록 짧게 (삭제는 BOTO_CFG 로 끈질기게)
SCAN_CFG = Config(retries={"max_attempts": 3, "mode": "standard"},
                  connect_timeout=3, read_timeout=10)
SCAN_DEADLINE = 90  # 초. 이 안에 안 끝난 리전/서비스는 건너뛰고 경고로 알린다

# 이 태그가 true/yes/1 이면 보호 대상 → 화면에서 선택 불가, 삭제 시에도 건너뜀
PROTECT_TAG = "keep"

class BoomError(Exception):
    """화면에 보여줄 오류. 문장 대신 코드(code)와 값(params)을 넘기고 번역은 화면(i18n.js)이 한다."""

    def __init__(self, code, **params):
        super().__init__(code)
        self.code, self.params = code, params


# 삭제 순서 (의존성 고려: 인스턴스/LB → NAT → EIP → 볼륨 → DB → S3)
TYPE_ORDER = [
    "EC2", "ELB", "VPC Endpoint", "NAT Gateway", "Elastic IP",
    "EBS Volume", "RDS", "RDS Cluster", "S3",
]


# ---------------------------------------------------------------- session
def make_session(profile=None, access_key=None, secret_key=None, session_token=None):
    if access_key:
        return boto3.Session(aws_access_key_id=access_key,
                             aws_secret_access_key=secret_key,
                             aws_session_token=session_token or None,
                             region_name="us-east-1")
    return boto3.Session(profile_name=profile or None, region_name="us-east-1")


def whoami(session):
    ident = session.client("sts", config=BOTO_CFG).get_caller_identity()
    return {"account": ident["Account"], "arn": ident["Arn"]}


def list_regions(session):
    resp = session.client("ec2", config=BOTO_CFG).describe_regions(AllRegions=False)
    return sorted(r["RegionName"] for r in resp["Regions"])


def available_profiles():
    return boto3.Session().available_profiles


# ---------------------------------------------------------------- helpers
def _tags_to_dict(tags):
    return {t.get("Key"): t.get("Value") for t in (tags or [])}


def _is_protected(tags: dict):
    for k, v in tags.items():
        if k and k.lower() == PROTECT_TAG and str(v).lower() in ("true", "yes", "1"):
            return True
    return False


# 리소스를 관리(생성)하는 상위 서비스. AWS 가 자동으로 붙이는 태그로 알아낸다.
# (태그 키, 표시 이름, 지워도 다시 생기나). 위에 있을수록 직접적인 관리 주체 (ASG 인스턴스가 CFN 스택 안에 있어도 ASG 우선)
MANAGERS = [
    ("aws:autoscaling:groupName", "autoscaling", True),
    ("eks:nodegroup-name", "eks-nodegroup", True),
    ("karpenter.sh/nodepool", "karpenter", True),
    ("karpenter.sh/provisioner-name", "karpenter", True),
    ("elasticbeanstalk:environment-name", "beanstalk", True),
    ("aws:ec2spot:fleet-request-id", "spot-fleet", True),
    ("aws:ec2:fleet-id", "ec2-fleet", True),
    ("aws:elasticmapreduce:job-flow-id", "emr", True),
    ("elbv2.k8s.aws/cluster", "eks-lb", True),
    ("kubernetes.io/service-name", "k8s-service", True),
    ("eks:cluster-name", "eks", True),
    ("aws:cloud9:environment", "cloud9", False),
    ("aws:cloudformation:stack-name", "cloudformation", False),
]


def managed_by(tags: dict):
    """{'by': 서비스, 'name': 그룹/스택 이름, 'respawn': 지워도 다시 생기나, 'stack': CFN 스택} 또는 None."""
    stack = tags.get("aws:cloudformation:stack-name")
    for key, label, respawn in MANAGERS:
        if key in tags:
            out = {"by": label, "name": tags[key], "respawn": respawn}
            if stack and label != "cloudformation":
                out["stack"] = stack
            return out
    for k in tags:
        if k.startswith("kubernetes.io/cluster/"):
            return {"by": "kubernetes", "name": k.rsplit("/", 1)[-1], "respawn": True}
    return None


def _item(rtype, region, rid, name="", state="", detail="", tags=None, flags=(), **extra):
    tags = tags or {}
    return {
        "key": f"{rtype}|{region}|{rid}",
        "type": rtype,
        "region": region,
        "id": rid,
        "name": name or tags.get("Name", ""),
        "state": state,
        "detail": detail,
        "protected": _is_protected(tags),
        "managed": managed_by(tags),
        "flags": list(flags),
        "extra": extra,
    }


def _fmt_time(dt):
    if not dt:
        return ""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


# ---------------------------------------------------------------- scanners (region)
def scan_ec2(session, region):
    ec2 = session.client("ec2", region_name=region, config=SCAN_CFG)
    out = []
    pages = ec2.get_paginator("describe_instances").paginate(
        Filters=[{"Name": "instance-state-name",
                  "Values": ["pending", "running", "stopping", "stopped"]}])
    for page in pages:
        for res in page["Reservations"]:
            for i in res["Instances"]:
                tags = _tags_to_dict(i.get("Tags"))
                out.append(_item(
                    "EC2", region, i["InstanceId"], tags=tags,
                    state=i["State"]["Name"],
                    detail=f'{i["InstanceType"]} · {_fmt_time(i.get("LaunchTime"))}'
                           + (f' · {i["PublicIpAddress"]}' if i.get("PublicIpAddress") else "")))
    return out


def scan_nat(session, region):
    ec2 = session.client("ec2", region_name=region, config=SCAN_CFG)
    out = []
    pages = ec2.get_paginator("describe_nat_gateways").paginate(
        Filters=[{"Name": "state", "Values": ["pending", "available"]}])
    for page in pages:
        for n in page["NatGateways"]:
            tags = _tags_to_dict(n.get("Tags"))
            ips = [a.get("PublicIp") for a in n.get("NatGatewayAddresses", []) if a.get("PublicIp")]
            out.append(_item(
                "NAT Gateway", region, n["NatGatewayId"], tags=tags, state=n["State"],
                detail=f'{n.get("VpcId", "")} · {", ".join(ips)}'))
    return out


def scan_eip(session, region):
    ec2 = session.client("ec2", region_name=region, config=SCAN_CFG)
    # NAT 게이트웨이가 쓰는 EIP 는 NAT 삭제 완료 후에 해제해야 한다
    nat_by_alloc = {}
    for page in ec2.get_paginator("describe_nat_gateways").paginate(
            Filters=[{"Name": "state", "Values": ["pending", "available", "deleting"]}]):
        for n in page["NatGateways"]:
            for a in n.get("NatGatewayAddresses", []):
                if a.get("AllocationId"):
                    nat_by_alloc[a["AllocationId"]] = n["NatGatewayId"]
    out = []
    for a in ec2.describe_addresses()["Addresses"]:
        tags = _tags_to_dict(a.get("Tags"))
        alloc = a.get("AllocationId", a.get("PublicIp"))
        nat_id = nat_by_alloc.get(alloc)
        if nat_id:
            state, where = "nat", nat_id
        elif a.get("InstanceId"):
            state, where = "associated", a["InstanceId"]
        elif a.get("AssociationId"):
            state, where = "associated", a.get("NetworkInterfaceId", "")
        else:
            state, where = "unassociated", ""
        out.append(_item(
            "Elastic IP", region, alloc, tags=tags, state=state,
            detail=f'{a.get("PublicIp")}' + (f" → {where}" if where else ""),
            association_id=a.get("AssociationId"), nat_id=nat_id,
            public_ip=a.get("PublicIp"), domain=a.get("Domain")))
    return out


def scan_ebs(session, region):
    """인스턴스에 붙지 않은(available) 볼륨만. 붙어있는 볼륨은 인스턴스와 함께 처리."""
    ec2 = session.client("ec2", region_name=region, config=SCAN_CFG)
    out = []
    pages = ec2.get_paginator("describe_volumes").paginate(
        Filters=[{"Name": "status", "Values": ["available"]}])
    for page in pages:
        for v in page["Volumes"]:
            tags = _tags_to_dict(v.get("Tags"))
            out.append(_item(
                "EBS Volume", region, v["VolumeId"], tags=tags, state="unattached",
                detail=f'{v["Size"]} GiB {v["VolumeType"]} · {_fmt_time(v.get("CreateTime"))}'))
    return out


def scan_vpc_endpoints(session, region):
    """Interface / GatewayLoadBalancer 엔드포인트 (시간당 과금되는 것들)."""
    ec2 = session.client("ec2", region_name=region, config=SCAN_CFG)
    out = []
    pages = ec2.get_paginator("describe_vpc_endpoints").paginate(
        Filters=[{"Name": "vpc-endpoint-type", "Values": ["Interface", "GatewayLoadBalancer"]}])
    for page in pages:
        for e in page["VpcEndpoints"]:
            if e.get("State", "").lower() in ("deleted", "deleting"):
                continue
            tags = _tags_to_dict(e.get("Tags"))
            out.append(_item(
                "VPC Endpoint", region, e["VpcEndpointId"], tags=tags, state=e.get("State", ""),
                detail=f'{e.get("ServiceName", "")} · {e.get("VpcId", "")}'))
    return out


def scan_elb(session, region):
    out = []
    v2 = session.client("elbv2", region_name=region, config=SCAN_CFG)
    lbs = []
    for page in v2.get_paginator("describe_load_balancers").paginate():
        lbs.extend(page["LoadBalancers"])
    tag_map = {}
    for i in range(0, len(lbs), 20):
        arns = [lb["LoadBalancerArn"] for lb in lbs[i:i + 20]]
        for d in v2.describe_tags(ResourceArns=arns)["TagDescriptions"]:
            tag_map[d["ResourceArn"]] = _tags_to_dict(d.get("Tags"))
    for lb in lbs:
        arn = lb["LoadBalancerArn"]
        out.append(_item(
            "ELB", region, lb["LoadBalancerName"], name=lb["LoadBalancerName"],
            tags=tag_map.get(arn), state=lb.get("State", {}).get("Code", ""),
            detail=f'{lb["Type"]} · {lb.get("DNSName", "")}', arn=arn, kind="v2"))

    classic = session.client("elb", region_name=region, config=SCAN_CFG)
    clbs = []
    for page in classic.get_paginator("describe_load_balancers").paginate():
        clbs.extend(page["LoadBalancerDescriptions"])
    ctags = {}
    for i in range(0, len(clbs), 20):
        names = [lb["LoadBalancerName"] for lb in clbs[i:i + 20]]
        for d in classic.describe_tags(LoadBalancerNames=names)["TagDescriptions"]:
            ctags[d["LoadBalancerName"]] = _tags_to_dict(d.get("Tags"))
    for lb in clbs:
        n = lb["LoadBalancerName"]
        out.append(_item("ELB", region, n, name=n, tags=ctags.get(n), state="active",
                         detail=f'classic · {lb.get("DNSName", "")}', kind="classic"))
    return out


def scan_rds(session, region):
    rds = session.client("rds", region_name=region, config=SCAN_CFG)
    out = []
    for page in rds.get_paginator("describe_db_instances").paginate():
        for d in page["DBInstances"]:
            if d.get("DBClusterIdentifier"):
                continue  # 클러스터 멤버는 클러스터 항목으로 함께 처리
            tags = _tags_to_dict(d.get("TagList"))
            out.append(_item(
                "RDS", region, d["DBInstanceIdentifier"], name=d["DBInstanceIdentifier"],
                tags=tags, state=d["DBInstanceStatus"],
                detail=f'{d["Engine"]} · {d["DBInstanceClass"]}',
                flags=["deletion_protection"] if d.get("DeletionProtection") else []))
    for page in rds.get_paginator("describe_db_clusters").paginate():
        for c in page["DBClusters"]:
            tags = _tags_to_dict(c.get("TagList"))
            members = [m["DBInstanceIdentifier"] for m in c.get("DBClusterMembers", [])]
            out.append(_item(
                "RDS Cluster", region, c["DBClusterIdentifier"], name=c["DBClusterIdentifier"],
                tags=tags, state=c["Status"],
                detail=f'{c["Engine"]} · ×{len(members)}',
                flags=["deletion_protection"] if c.get("DeletionProtection") else [],
                members=members))
    return out


REGIONAL_SCANNERS = {
    "EC2": scan_ec2,
    "NAT Gateway": scan_nat,
    "Elastic IP": scan_eip,
    "EBS Volume": scan_ebs,
    "VPC Endpoint": scan_vpc_endpoints,
    "ELB": scan_elb,
    "RDS": scan_rds,  # RDS + RDS Cluster
}


# ---------------------------------------------------------------- scanners (global)
def scan_s3(session):
    s3 = session.client("s3", config=SCAN_CFG)
    buckets = s3.list_buckets().get("Buckets", [])

    def one(b):
        name = b["Name"]
        try:
            region = s3.get_bucket_location(Bucket=name).get("LocationConstraint") or "us-east-1"
        except ClientError:
            region = "?"
        if region == "EU":
            region = "eu-west-1"
        tags = {}
        try:
            c = session.client("s3", region_name=region if region != "?" else None, config=SCAN_CFG)
            tags = _tags_to_dict(c.get_bucket_tagging(Bucket=name).get("TagSet"))
        except ClientError:
            pass
        return _item("S3", region, name, name=name, tags=tags, state="bucket",
                     detail=_fmt_time(b.get("CreationDate")))

    with ThreadPoolExecutor(max_workers=16) as pool:
        return list(pool.map(one, buckets))


def scan_all(session, regions, types=None, progress=None, deadline=SCAN_DEADLINE):
    """모든 리전을 병렬 스캔. (items, warnings) 반환.

    deadline 초가 지나도 안 끝난 작업은 기다리지 않고 '응답 없음' 경고로 돌린다.
    (응답 없는 리전 하나 때문에 스캔 전체가 멈춰 보이던 문제)
    """
    types = set(types or TYPE_ORDER)
    items, warnings = [], []
    tasks = {}
    pool = ThreadPoolExecutor(max_workers=24)
    for region in regions:
        for rtype, fn in REGIONAL_SCANNERS.items():
            wanted = rtype in types or (rtype == "RDS" and "RDS Cluster" in types)
            if wanted:
                tasks[pool.submit(_safe_scan, fn, session, region, rtype)] = (region, rtype)
    if "S3" in types:
        tasks[pool.submit(_safe_scan, lambda s, _r: scan_s3(s), session, "global", "S3")] = ("global", "S3")
    total = len(tasks)
    if progress:
        progress(0, total, [])
    done = set()
    try:
        for fut in as_completed(tasks, timeout=deadline):
            done.add(fut)
            res, warn = fut.result()
            items.extend(i for i in res if i["type"] in types)
            if warn:
                warnings.append(warn)
            if progress:
                progress(len(done), total, sorted({tasks[f][0] for f in tasks if f not in done}))
    except TimeoutError:
        for fut, (region, rtype) in tasks.items():
            if fut not in done:
                warnings.append({"region": region, "type": rtype, "code": "timeout", "sec": deadline})
    finally:
        pool.shutdown(wait=False, cancel_futures=True)  # 매달린 요청은 백그라운드에서 알아서 끝나게 둔다
    items.sort(key=lambda i: (TYPE_ORDER.index(i["type"]), i["region"], i["id"]))
    return items, warnings


def _safe_scan(fn, session, region, rtype):
    try:
        return fn(session, region), None
    except (ClientError, BotoCoreError) as e:
        return [], {"region": region, "type": rtype, "code": "aws", "detail": _err(e)}


def _err(e):
    if isinstance(e, ClientError):
        err = e.response.get("Error", {})
        return f'{err.get("Code")}: {err.get("Message")}'
    return str(e)


# ---------------------------------------------------------------- topology
def _paginate(client, op, key, **kw):
    out = []
    for page in client.get_paginator(op).paginate(**kw):
        out.extend(page.get(key, []))
    return out


def _route_target(r):
    for k in ("GatewayId", "NatGatewayId", "VpcPeeringConnectionId", "TransitGatewayId",
              "NetworkInterfaceId", "InstanceId", "EgressOnlyInternetGatewayId",
              "CarrierGatewayId", "LocalGatewayId", "CoreNetworkArn"):
        if r.get(k):
            return r[k]
    return "?"


def scan_topology_region(session, region):
    """한 리전의 네트워크 구조. VPC > AZ > Subnet > 리소스, 라우팅 테이블, IGW/NAT/피어링/TGW."""
    ec2 = session.client("ec2", region_name=region, config=SCAN_CFG)
    azs = sorted(z["ZoneName"] for z in ec2.describe_availability_zones(
        Filters=[{"Name": "state", "Values": ["available"]}])["AvailabilityZones"]
        if z.get("ZoneType", "availability-zone") == "availability-zone")
    vpcs = _paginate(ec2, "describe_vpcs", "Vpcs")
    if not vpcs:
        return {"region": region, "azs": azs, "vpcs": [], "peerings": [], "tgws": [], "buckets": []}
    subnets = _paginate(ec2, "describe_subnets", "Subnets")
    rts = _paginate(ec2, "describe_route_tables", "RouteTables")
    igws = _paginate(ec2, "describe_internet_gateways", "InternetGateways")
    nats = _paginate(ec2, "describe_nat_gateways", "NatGateways",
                     Filters=[{"Name": "state", "Values": ["pending", "available"]}])
    pcxs = _paginate(ec2, "describe_vpc_peering_connections", "VpcPeeringConnections",
                     Filters=[{"Name": "status-code",
                               "Values": ["active", "pending-acceptance", "provisioning", "initiating-request"]}])
    eps = _paginate(ec2, "describe_vpc_endpoints", "VpcEndpoints")
    reservations = _paginate(ec2, "describe_instances", "Reservations",
                             Filters=[{"Name": "instance-state-name",
                                       "Values": ["pending", "running", "stopping", "stopped"]}])
    try:
        tgws = _paginate(ec2, "describe_transit_gateways", "TransitGateways")
        tgw_atts = _paginate(ec2, "describe_transit_gateway_attachments", "TransitGatewayAttachments",
                             Filters=[{"Name": "resource-type", "Values": ["vpc"]}])
    except ClientError:
        tgws, tgw_atts = [], []

    lbs = []
    try:
        lbs = _paginate(session.client("elbv2", region_name=region, config=SCAN_CFG),
                        "describe_load_balancers", "LoadBalancers")
    except ClientError:
        pass
    dbs = []
    try:
        dbs = _paginate(session.client("rds", region_name=region, config=SCAN_CFG),
                        "describe_db_instances", "DBInstances")
    except ClientError:
        pass

    name = lambda o: _tags_to_dict(o.get("Tags")).get("Name", "")  # noqa: E731

    # 라우팅 테이블: 명시적 연결 + VPC 별 main 테이블
    route_tables, rt_by_subnet, main_rt = {}, {}, {}
    for rt in rts:
        routes = [{"dest": r.get("DestinationCidrBlock") or r.get("DestinationIpv6CidrBlock")
                           or r.get("DestinationPrefixListId", "?"),
                   "target": _route_target(r), "state": r.get("State", "active")}
                  for r in rt.get("Routes", [])]
        assoc = [a["SubnetId"] for a in rt.get("Associations", []) if a.get("SubnetId")]
        is_main = any(a.get("Main") for a in rt.get("Associations", []))
        route_tables[rt["RouteTableId"]] = {"id": rt["RouteTableId"], "name": name(rt), "vpc": rt["VpcId"],
                                            "main": is_main, "subnets": assoc, "routes": routes}
        for s in assoc:
            rt_by_subnet[s] = rt["RouteTableId"]
        if is_main:
            main_rt[rt["VpcId"]] = rt["RouteTableId"]

    def rt_of(subnet):
        return rt_by_subnet.get(subnet["SubnetId"]) or main_rt.get(subnet["VpcId"])

    res_by_subnet = {s["SubnetId"]: [] for s in subnets}

    def put(subnet_id, item):
        if subnet_id in res_by_subnet:
            res_by_subnet[subnet_id].append(item)

    for r in reservations:
        for i in r["Instances"]:
            put(i.get("SubnetId"), {
                "type": "EC2", "id": i["InstanceId"], "name": name(i), "state": i["State"]["Name"],
                "detail": i["InstanceType"], "private_ip": i.get("PrivateIpAddress"),
                "public_ip": i.get("PublicIpAddress"),
                "sgs": [g["GroupName"] for g in i.get("SecurityGroups", [])],
                "managed": managed_by(_tags_to_dict(i.get("Tags")))})
    for n in nats:
        ips = [a.get("PublicIp") for a in n.get("NatGatewayAddresses", []) if a.get("PublicIp")]
        put(n.get("SubnetId"), {"type": "NAT Gateway", "id": n["NatGatewayId"], "name": name(n),
                                "state": n["State"], "detail": ", ".join(ips),
                                "connectivity": n.get("ConnectivityType", "public"),
                                "managed": managed_by(_tags_to_dict(n.get("Tags")))})
    vpc_level_eps = {}
    for e in eps:
        if e.get("State", "").lower() in ("deleted", "deleting"):
            continue
        svc = e.get("ServiceName", "").split(".")[-1]
        item = {"type": "VPC Endpoint", "id": e["VpcEndpointId"], "name": name(e) or svc,
                "state": e.get("State", ""), "detail": f'{e.get("VpcEndpointType")} · {e.get("ServiceName", "")}'}
        if e.get("VpcEndpointType") == "Gateway":
            vpc_level_eps.setdefault(e["VpcId"], []).append(item)
        for sid in e.get("SubnetIds", []):
            put(sid, item)
    for lb in lbs:
        for az in lb.get("AvailabilityZones", []):
            put(az.get("SubnetId"), {"type": "ELB", "id": lb["LoadBalancerName"], "name": lb["LoadBalancerName"],
                                     "state": lb.get("State", {}).get("Code", ""),
                                     "detail": f'{lb["Type"]} · {lb.get("Scheme", "")}'})
    for d in dbs:
        group = d.get("DBSubnetGroup") or {}
        sid = next((s["SubnetIdentifier"] for s in group.get("Subnets", [])
                    if s.get("SubnetAvailabilityZone", {}).get("Name") == d.get("AvailabilityZone")), None)
        put(sid, {"type": "RDS", "id": d["DBInstanceIdentifier"], "name": d["DBInstanceIdentifier"],
                  "state": d["DBInstanceStatus"], "detail": f'{d["Engine"]} · {d["DBInstanceClass"]}',
                  "managed": managed_by(_tags_to_dict(d.get("TagList")))})

    igw_by_vpc = {a["VpcId"]: g["InternetGatewayId"] for g in igws for a in g.get("Attachments", [])}
    atts_by_vpc = {}
    for a in tgw_atts:
        if a.get("State") in ("deleted", "deleting", "failed", "rejected"):
            continue
        atts_by_vpc.setdefault(a.get("ResourceId"), []).append(
            {"id": a["TransitGatewayAttachmentId"], "tgw": a["TransitGatewayId"], "state": a["State"]})

    out_vpcs = []
    for v in vpcs:
        vid = v["VpcId"]
        vsubs = []
        for s in sorted((s for s in subnets if s["VpcId"] == vid), key=lambda s: (s["AvailabilityZone"], s["CidrBlock"])):
            rt_id = rt_of(s)
            rt = route_tables.get(rt_id, {})
            public = any(r["dest"] in ("0.0.0.0/0", "::/0") and str(r["target"]).startswith("igw-")
                         for r in rt.get("routes", []))
            vsubs.append({"id": s["SubnetId"], "name": name(s), "cidr": s["CidrBlock"], "az": s["AvailabilityZone"],
                          "public": public, "rt": rt_id, "free_ips": s.get("AvailableIpAddressCount"),
                          "resources": res_by_subnet.get(s["SubnetId"], [])})
        out_vpcs.append({
            "id": vid, "name": name(v), "cidr": v["CidrBlock"], "default": v.get("IsDefault", False),
            "state": v.get("State"), "igw": igw_by_vpc.get(vid), "subnets": vsubs,
            "route_tables": [rt for rt in route_tables.values() if rt["vpc"] == vid],
            "gateway_endpoints": vpc_level_eps.get(vid, []), "tgw_attachments": atts_by_vpc.get(vid, []),
        })

    peerings = [{"id": p["VpcPeeringConnectionId"], "status": p["Status"]["Code"],
                 "name": name(p),
                 "a": {"vpc": p["RequesterVpcInfo"].get("VpcId"), "region": p["RequesterVpcInfo"].get("Region", region),
                       "owner": p["RequesterVpcInfo"].get("OwnerId"), "cidr": p["RequesterVpcInfo"].get("CidrBlock")},
                 "b": {"vpc": p["AccepterVpcInfo"].get("VpcId"), "region": p["AccepterVpcInfo"].get("Region", region),
                       "owner": p["AccepterVpcInfo"].get("OwnerId"), "cidr": p["AccepterVpcInfo"].get("CidrBlock")}}
                for p in pcxs]
    return {"region": region, "azs": azs, "vpcs": out_vpcs, "peerings": peerings, "buckets": [],
            "tgws": [{"id": t["TransitGatewayId"], "name": name(t), "state": t["State"]} for t in tgws
                     if t["State"] not in ("deleted", "deleting")]}


def scan_topology(session, regions, timeout=SCAN_DEADLINE):
    """리전 병렬 스캔. 느린 리전이 있어도 timeout 후엔 받은 것만 돌려준다."""
    from concurrent.futures import wait
    pool = ThreadPoolExecutor(max_workers=12)
    futs = {pool.submit(scan_topology_region, session, r): r for r in regions}
    s3_fut = pool.submit(scan_s3, session)  # S3 는 VPC 밖 리전 서비스로 리전 상자에 표시
    done, pending = wait([*futs, s3_fut], timeout=timeout)
    pool.shutdown(wait=False, cancel_futures=True)
    out, warnings = [], [{"region": futs.get(f, "global"), "type": "" if f in futs else "S3", "code": "timeout",
                          "sec": timeout} for f in pending]
    for f in done:
        if f is s3_fut:
            continue
        try:
            out.append(f.result())
        except (ClientError, BotoCoreError) as e:
            warnings.append({"region": futs[f], "type": "", "code": "aws", "detail": _err(e)})
    if s3_fut in done:
        try:
            by_region = {r["region"]: r for r in out}
            for b in s3_fut.result():
                if b["region"] in by_region:
                    by_region[b["region"]]["buckets"].append(
                        {"type": "S3", "id": b["id"], "name": b["name"], "state": "bucket", "detail": b["detail"]})
        except (ClientError, BotoCoreError) as e:
            warnings.append({"region": "global", "type": "S3", "code": "aws", "detail": _err(e)})
    out.sort(key=lambda r: r["region"])
    return {"regions": out, "warnings": warnings, "as_of": datetime.now().strftime("%H:%M:%S")}


# ---------------------------------------------------------------- 누가 만들었나 (CloudTrail)
CREATE_EVENTS = {
    "EC2": {"RunInstances"}, "NAT Gateway": {"CreateNatGateway"}, "Elastic IP": {"AllocateAddress"},
    "EBS Volume": {"CreateVolume"}, "VPC Endpoint": {"CreateVpcEndpoint"}, "ELB": {"CreateLoadBalancer"},
    "RDS": {"CreateDBInstance", "CreateDBInstanceReadReplica", "RestoreDBInstanceFromDBSnapshot"},
    "RDS Cluster": {"CreateDBCluster", "RestoreDBClusterFromSnapshot"}, "S3": {"CreateBucket"},
}


def _who(identity: dict):
    """CloudTrail userIdentity → (종류, 이름). 종류: service | root | user."""
    if identity.get("invokedBy", "").endswith(".amazonaws.com"):
        return "service", identity["invokedBy"].split(".")[0]
    kind = identity.get("type")
    if kind == "Root":
        return "root", ""
    if kind == "IAMUser":
        return "user", identity.get("userName") or identity.get("arn", "")
    if kind == "AssumedRole":
        role = identity.get("sessionContext", {}).get("sessionIssuer", {}).get("userName", "")
        session = identity.get("arn", "").rsplit("/", 1)[-1]
        return "user", f"{role} / {session}" if role else session
    return "user", identity.get("arn") or kind or "?"


def who_created(session, region, rid, rtype, alt_ids=()):
    """리소스 생성 이벤트를 CloudTrail 최근 90일 기록에서 찾는다. LookupEvents 는 무료(초당 2회 제한)."""
    import json as _json

    events = CREATE_EVENTS.get(rtype, set())
    ct = session.client("cloudtrail", region_name=region, config=SCAN_CFG)
    for name in (rid, *alt_ids):
        pages = ct.get_paginator("lookup_events").paginate(
            LookupAttributes=[{"AttributeKey": "ResourceName", "AttributeValue": name}],
            PaginationConfig={"MaxItems": 300, "PageSize": 50})
        for page in pages:
            for ev in page.get("Events", []):
                if ev.get("EventName") not in events:
                    continue
                detail = _json.loads(ev.get("CloudTrailEvent") or "{}")
                ident = detail.get("userIdentity", {})
                who_kind, who = _who(ident)
                return {"found": True, "who": who, "who_kind": who_kind, "arn": ident.get("arn", ""),
                        "event": ev["EventName"], "time": ev["EventTime"].isoformat(),
                        "ip": detail.get("sourceIPAddress", "")}
    return {"found": False}


# ---------------------------------------------------------------- create (토폴로지 우클릭 메뉴)
AL2023_PARAM = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"


def _name_tags(resource_type, name):
    return [{"ResourceType": resource_type, "Tags": [{"Key": "Name", "Value": name}]}] if name else []


def create_vpc(session, region, cidr, name="", with_igw=False):
    ec2 = session.client("ec2", region_name=region, config=BOTO_CFG)
    vpc = ec2.create_vpc(CidrBlock=cidr, TagSpecifications=_name_tags("vpc", name))["Vpc"]["VpcId"]
    ec2.modify_vpc_attribute(VpcId=vpc, EnableDnsHostnames={"Value": True})
    out = {"id": vpc}
    if with_igw:
        out["igw"] = create_igw(session, region, vpc, f"{name}-igw" if name else "")["id"]
    return out


def create_igw(session, region, vpc, name=""):
    ec2 = session.client("ec2", region_name=region, config=BOTO_CFG)
    igw = ec2.create_internet_gateway(
        TagSpecifications=_name_tags("internet-gateway", name))["InternetGateway"]["InternetGatewayId"]
    ec2.attach_internet_gateway(InternetGatewayId=igw, VpcId=vpc)
    return {"id": igw}


def create_subnet(session, region, vpc, az, cidr, name=""):
    ec2 = session.client("ec2", region_name=region, config=BOTO_CFG)
    sid = ec2.create_subnet(VpcId=vpc, AvailabilityZone=az, CidrBlock=cidr,
                            TagSpecifications=_name_tags("subnet", name))["Subnet"]["SubnetId"]
    return {"id": sid}


def _latest_ami(session, region):
    """Amazon Linux 2023 최신 AMI. SSM 공개 파라미터 → 안 되면 이미지 검색."""
    try:
        return session.client("ssm", region_name=region, config=BOTO_CFG)             .get_parameter(Name=AL2023_PARAM)["Parameter"]["Value"]
    except (ClientError, BotoCoreError):
        pass
    images = session.client("ec2", region_name=region, config=BOTO_CFG).describe_images(
        Owners=["amazon"], Filters=[{"Name": "name", "Values": ["al2023-ami-2023*-x86_64"]},
                                    {"Name": "state", "Values": ["available"]}])["Images"]
    if not images:
        raise BoomError("no_ami")
    return max(images, key=lambda i: i.get("CreationDate", ""))["ImageId"]


def launch_instance(session, region, subnet, instance_type, name="", public_ip=False):
    ec2 = session.client("ec2", region_name=region, config=BOTO_CFG)
    ami = _latest_ami(session, region)
    r = ec2.run_instances(
        ImageId=ami, InstanceType=instance_type, MinCount=1, MaxCount=1,
        NetworkInterfaces=[{"DeviceIndex": 0, "SubnetId": subnet, "AssociatePublicIpAddress": bool(public_ip)}],
        TagSpecifications=_name_tags("instance", name))
    return {"id": r["Instances"][0]["InstanceId"], "ami": ami}


# ---------------------------------------------------------------- cost
def get_costs(session):
    """Cost Explorer 로 지난달 1일 ~ 오늘 일별·서비스별 비용 + 이번 달 예측.

    CE API 는 요청당 $0.01 과금되므로 호출을 최소화한다 (보통 2회).
    """
    from datetime import date, timedelta

    ce = session.client("ce", region_name="us-east-1", config=BOTO_CFG)
    today = date.today()
    month_start = today.replace(day=1)
    prev_start = (month_start - timedelta(days=1)).replace(day=1)
    end = today + timedelta(days=1)  # End 는 exclusive

    daily, by_service_mtd, prev_total, currency = {}, {}, 0.0, "USD"
    kw = dict(TimePeriod={"Start": prev_start.isoformat(), "End": end.isoformat()},
              Granularity="DAILY", Metrics=["UnblendedCost"],
              GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}])
    while True:
        resp = ce.get_cost_and_usage(**kw)
        for day in resp["ResultsByTime"]:
            d = day["TimePeriod"]["Start"]
            for g in day.get("Groups", []):
                m = g["Metrics"]["UnblendedCost"]
                amt = float(m["Amount"])
                currency = m.get("Unit", currency)
                daily[d] = daily.get(d, 0.0) + amt
                if d >= month_start.isoformat():
                    svc = g["Keys"][0]
                    by_service_mtd[svc] = by_service_mtd.get(svc, 0.0) + amt
                else:
                    prev_total += amt
        if not resp.get("NextPageToken"):
            break
        kw["NextPageToken"] = resp["NextPageToken"]

    mtd = sum(v for d, v in daily.items() if d >= month_start.isoformat())
    # 지난달 같은 날짜까지의 비용 (전월 동기 대비)
    prev_same = sum(v for d, v in daily.items()
                    if d < month_start.isoformat() and int(d[8:10]) <= today.day)

    forecast = None
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    if end < next_month:
        try:
            f = ce.get_cost_forecast(
                TimePeriod={"Start": end.isoformat(), "End": next_month.isoformat()},
                Metric="UNBLENDED_COST", Granularity="MONTHLY")
            forecast = mtd + float(f["Total"]["Amount"])
        except ClientError:
            forecast = None  # 데이터가 부족한 신규 계정 등
    else:
        forecast = mtd

    services = sorted(((k, v) for k, v in by_service_mtd.items() if abs(v) >= 0.005),
                      key=lambda kv: -kv[1])
    return {
        "currency": currency,
        "mtd": mtd,
        "forecast": forecast,
        "prev_month_total": prev_total,
        "prev_month_same_period": prev_same,
        "services": [{"name": k, "amount": v} for k, v in services],
        # 데이터가 며칠 없어도 항상 30칸 (빈 날은 0) — 막대가 화면을 꽉 채우며 뚱뚱해지지 않게
        "daily": [{"date": d, "amount": daily.get(d, 0.0)}
                  for d in ((today - timedelta(days=i)).isoformat() for i in range(29, -1, -1))],
        "month_start": month_start.isoformat(),
        "as_of": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }


# ---------------------------------------------------------------- deleters
def _wait(check, timeout=900, interval=10):
    """check() 가 True 를 반환할 때까지 대기."""
    end = time.time() + timeout
    while time.time() < end:
        if check():
            return True
        time.sleep(interval)
    return False


def delete_ec2(session, it, opts, log):
    ec2 = session.client("ec2", region_name=it["region"], config=BOTO_CFG)
    if opts.get("ec2_mode") == "stop":
        ec2.stop_instances(InstanceIds=[it["id"]])
        return "stop_requested", {}
    ec2.terminate_instances(InstanceIds=[it["id"]])
    return "terminate_requested", {}


def delete_nat(session, it, opts, log):
    ec2 = session.client("ec2", region_name=it["region"], config=BOTO_CFG)
    ec2.delete_nat_gateway(NatGatewayId=it["id"])
    return "delete_requested", {}


def delete_eip(session, it, opts, log):
    ec2 = session.client("ec2", region_name=it["region"], config=BOTO_CFG)
    ex = it["extra"]
    if ex.get("nat_id"):
        nat_id = ex["nat_id"]
        log("wait_nat", id=nat_id)

        def nat_gone():
            try:
                r = ec2.describe_nat_gateways(NatGatewayIds=[nat_id])["NatGateways"]
            except ClientError:
                return True
            return not r or r[0]["State"] in ("deleted", "failed")
        if not _wait(nat_gone):
            raise BoomError("nat_not_gone", id=nat_id)
        # NAT 삭제 직후엔 연결 해제가 조금 늦게 반영될 수 있음
        time.sleep(5)
    elif ex.get("association_id"):
        ec2.disassociate_address(AssociationId=ex["association_id"])
        log("disassociated")
    if ex.get("domain") == "standard":
        ec2.release_address(PublicIp=ex["public_ip"])
    else:
        for attempt in range(6):
            try:
                ec2.release_address(AllocationId=it["id"])
                break
            except ClientError as e:
                if e.response["Error"]["Code"] in ("InvalidIPAddress.InUse", "AuthFailure") and attempt < 5:
                    time.sleep(10)
                    continue
                raise
    return "released", {}


def delete_ebs(session, it, opts, log):
    ec2 = session.client("ec2", region_name=it["region"], config=BOTO_CFG)
    ec2.delete_volume(VolumeId=it["id"])
    return "deleted", {}


def delete_vpce(session, it, opts, log):
    ec2 = session.client("ec2", region_name=it["region"], config=BOTO_CFG)
    r = ec2.delete_vpc_endpoints(VpcEndpointIds=[it["id"]])
    if r.get("Unsuccessful"):
        raise BoomError("aws", detail=r["Unsuccessful"][0]["Error"]["Message"])
    return "delete_requested", {}


def delete_elb(session, it, opts, log):
    if it["extra"].get("kind") == "classic":
        session.client("elb", region_name=it["region"], config=BOTO_CFG) \
            .delete_load_balancer(LoadBalancerName=it["id"])
    else:
        session.client("elbv2", region_name=it["region"], config=BOTO_CFG) \
            .delete_load_balancer(LoadBalancerArn=it["extra"]["arn"])
    return "deleted", {}


def _snapshot_name(base):
    return f'{base}-final-{datetime.now().strftime("%Y%m%d%H%M%S")}'[:255]


def delete_rds(session, it, opts, log):
    rds = session.client("rds", region_name=it["region"], config=BOTO_CFG)
    kw = {"DBInstanceIdentifier": it["id"], "DeleteAutomatedBackups": True}
    if opts.get("rds_snapshot"):
        kw["FinalDBSnapshotIdentifier"] = _snapshot_name(it["id"])
    else:
        kw["SkipFinalSnapshot"] = True
    rds.delete_db_instance(**kw)
    if opts.get("rds_snapshot"):
        return "delete_requested_snapshot", {"snapshot": kw["FinalDBSnapshotIdentifier"]}
    return "delete_requested", {}


def delete_rds_cluster(session, it, opts, log):
    rds = session.client("rds", region_name=it["region"], config=BOTO_CFG)
    for m in it["extra"].get("members", []):
        try:
            rds.delete_db_instance(DBInstanceIdentifier=m)
            log("member_delete", id=m)
        except ClientError as e:
            if e.response["Error"]["Code"] != "InvalidDBInstanceState":
                raise
    kw = {"DBClusterIdentifier": it["id"]}
    if opts.get("rds_snapshot"):
        kw["FinalDBSnapshotIdentifier"] = _snapshot_name(it["id"])
    else:
        kw["SkipFinalSnapshot"] = True
    for attempt in range(30):
        try:
            rds.delete_db_cluster(**kw)
            return "delete_requested", {}
        except ClientError as e:
            if e.response["Error"]["Code"] == "InvalidDBClusterStateFault" and attempt < 29:
                if attempt == 0:
                    log("wait_members")
                time.sleep(10)
                continue
            raise


def delete_s3(session, it, opts, log):
    region = it["region"] if it["region"] != "?" else None
    s3 = session.client("s3", region_name=region, config=BOTO_CFG)
    name = it["id"]
    removed = 0
    # 버전/삭제마커 포함 전부 비우기 (버전관리 꺼진 버킷도 Version null 로 나온다)
    for page in s3.get_paginator("list_object_versions").paginate(Bucket=name):
        objs = [{"Key": o["Key"], "VersionId": o["VersionId"]}
                for o in page.get("Versions", []) + page.get("DeleteMarkers", [])]
        for i in range(0, len(objs), 1000):
            r = s3.delete_objects(Bucket=name, Delete={"Objects": objs[i:i + 1000], "Quiet": True})
            if r.get("Errors"):
                e = r["Errors"][0]
                raise BoomError("object_delete_failed", key=e.get("Key"), msg=e.get("Message"))
            removed += len(objs[i:i + 1000])
        if removed:
            log("objects_deleted", n=removed)
    s3.delete_bucket(Bucket=name)
    return "bucket_deleted", {"n": removed}


DELETERS = {
    "EC2": delete_ec2,
    "NAT Gateway": delete_nat,
    "Elastic IP": delete_eip,
    "EBS Volume": delete_ebs,
    "VPC Endpoint": delete_vpce,
    "ELB": delete_elb,
    "RDS": delete_rds,
    "RDS Cluster": delete_rds_cluster,
    "S3": delete_s3,
}


def delete_items(session, items, opts, log):
    """의존성 순서대로 삭제. 결과 {key: {ok, k, p}} 반환.

    log(k, **p) 와 결과의 k/p 는 문장이 아니라 메시지 코드와 값이다 (번역은 화면에서).
    """
    results = {}
    dry = opts.get("dry_run", True)
    ordered = sorted(items, key=lambda i: TYPE_ORDER.index(i["type"]))
    for it in ordered:
        label = f'[{it["type"]}] {it["region"]} {it["id"]}' + (
            f' ({it["name"]})' if it["name"] and it["name"] != it["id"] else "")
        if it["protected"]:
            log("skip_protected", label=label, tag=PROTECT_TAG)
            results[it["key"]] = {"ok": False, "k": "protected", "p": {}}
            continue
        if dry:
            log("dry_item", label=label)
            results[it["key"]] = {"ok": True, "k": "dry", "p": {}}
            continue
        log("begin", label=label)
        try:
            k, p = DELETERS[it["type"]](session, it, opts, lambda code, **kw: log(code, **kw))
            log("ok", label=label, code=k, params=p)
            results[it["key"]] = {"ok": True, "k": k, "p": p}
        except BoomError as e:
            log("fail", label=label, code=e.code, params=e.params)
            results[it["key"]] = {"ok": False, "k": e.code, "p": e.params}
        except (ClientError, BotoCoreError) as e:
            log("fail", label=label, code="aws", params={"detail": _err(e)})
            results[it["key"]] = {"ok": False, "k": "aws", "p": {"detail": _err(e)}}
    return results
