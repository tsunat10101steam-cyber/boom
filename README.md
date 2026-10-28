# Boom

**Boom** is a Windows desktop app that finds the AWS resources running (and billing) in your account across all regions,
shows them on a dashboard with your month-to-date cost, and lets you stop or delete them in bulk.
It also draws your network architecture (regions, VPCs, AZs, subnets, peering, routes) as an interactive topology view.

- Download: [latest release](../../releases/latest) — `Boom-Setup-X.Y.Z.exe` (installer) or `Boom-vX.Y.Z.zip` (portable)
- Languages: English, 한국어, 日本語, 简体中文, 繁體中文, Deutsch, Français, Español
- License: [MIT](LICENSE)
- [Code signing policy](CODE_SIGNING.md) — Free code signing provided by SignPath.io, certificate by SignPath Foundation
- Privacy: no telemetry; Boom only talks to AWS (your account, your credentials) and GitHub (update checks, can be turned off). See [Code signing policy → Privacy policy](CODE_SIGNING.md#privacy-policy).

---

AWS 계정에서 지금 돌고 있는(=과금되는) 리소스를 전 리전에서 찾아 보여주고, 골라서 한 번에 종료/삭제하는 로컬 웹 도구.

## 설치 / 실행

**설치 (권장)**: [Releases](../../releases/latest) 에서 `Boom-Setup-X.Y.Z.exe` 를 받아 실행.
관리자 권한 없이 `%LOCALAPPDATA%\Programs\Boom` 에 설치되고, 시작 메뉴·바탕화면 바로가기가 생기며,
설정 → 앱에서 제거할 수 있다. (저장된 액세스 키는 제거해도 남는다: `%LOCALAPPDATA%\Boom`)

**포터블**: 같은 페이지의 `Boom-vX.Y.Z.zip` 을 풀고 `Boom.exe` 실행.

Windows 10/11 + Microsoft Edge(또는 Chrome) 필요.

> 아직 코드 서명이 없어서 처음 실행할 때 Windows SmartScreen 이 "Windows의 PC 보호" 창을 띄울 수 있다.
> **추가 정보 → 실행** 을 누르면 된다. (회사 PC 정책이나 Windows 11 '스마트 앱 컨트롤'이 켜져 있으면 서명 없는 앱은 아예 막힌다.)

**소스에서 빌드**:

```
build.bat
```

`Boom.exe` 를 빌드해 `%LOCALAPPDATA%\Programs\Boom` 에 설치하고 바탕화면·시작 메뉴에 **Boom** 바로가기를 만든다.
이후엔 다른 프로그램처럼 아이콘을 더블클릭해서 실행 (작업 표시줄 고정도 가능). 코드를 고쳤으면 `build.bat` 을 다시 실행.

## 언어

⚙ 설정 → 언어에서 한국어, English, 日本語, 简体中文, 繁體中文, Deutsch, Français, Español 중에 고른다.
처음엔 Windows 언어를 따라간다. 문구는 `static/i18n.js` 한 파일에 있고, 서버는 문장 대신 코드만 보낸다.

## 버전 / 업데이트

- 대시보드 맨 아래에 현재 버전이 보인다.
- GitHub 에 새 릴리스가 나오면 위쪽에 **업데이트 vX.Y.Z** 버튼이 뜬다. 누르면 변경 내역을 보여주고,
  "지금 업데이트" 를 누르면 새 버전을 받아 설치한 뒤 Boom 이 다시 열린다.
- 새 버전 내기: `version.py` 와 `CHANGELOG.md` 맨 위에 `## vX.Y.Z` 항목을 추가하고 커밋한 뒤 같은 이름의 태그를 푸시.
  GitHub Actions(`.github/workflows/release.yml`)가 빌드해서 릴리스를 만든다.

  ```
  git tag v1.1.0
  git push origin v1.1.0
  ```

실행하면 콘솔 없이 Edge/Chrome **앱 창**으로 대시보드가 열리고, 창을 닫으면 백그라운드 서버도 자동 종료된다
(삭제 작업이 진행 중이면 끝날 때까지 유지).

개발 중엔 빌드 없이 `run.bat` (또는 브라우저 탭으로 `python app.py --browser`).

## 대시보드

- **이번 달 누적 요금** / 월말 예상 / 지난달 같은 기간 대비 / 최근 30일 일별 그래프
- **서비스별 요금** (이번 달)
- **실행 중인 리소스** 종류별 카운트 — 클릭하면 아래 표가 필터링됨
- **확인 필요** — NAT, 미연결 EIP/EBS, 중지된 EC2 등 돈만 나가는 리소스
- **리전별 리소스** 분포

요금은 Cost Explorer API 로 가져온다. **API 요청당 $0.01 과금**이라 1시간 캐시하며, ↻ 버튼으로만 강제 갱신한다 (갱신 1회 = 요청 2건).
필요 권한: `ce:GetCostAndUsage`, `ce:GetCostForecast`. Cost Explorer 를 처음 쓰는 계정은 콘솔에서 한 번 활성화해야 하고 데이터가 쌓이는 데 최대 24시간 걸린다.

아이콘을 고쳤다면 `static/icon.svg` 수정 후 `.venv\Scripts\python tools\make_icon.py` (Pillow 필요) 로 PNG/ICO 재생성.

## 연결 방법

- **프로필**: `~/.aws/credentials` 의 프로필, 또는 `AWS_ACCESS_KEY_ID` 등 환경변수
- **액세스 키 직접 입력**: 화면에 입력. "이 PC 에 기억하기"(기본 켜짐)면 다음 실행부터 자동 연결된다.
  키는 Windows DPAPI 로 암호화해 `%LOCALAPPDATA%\Boom\credentials.bin` 에 저장되며, 같은 Windows 계정에서만 풀린다.
  **연결 해제**를 누르면 저장된 키도 삭제된다.

## 대상 리소스

| 종류 | 스캔 조건 | 동작 |
|---|---|---|
| EC2 | pending/running/stopping/stopped | terminate 또는 stop |
| ELB | ALB/NLB/GWLB + Classic | 삭제 |
| VPC Endpoint | Interface / GWLB 타입 | 삭제 |
| NAT Gateway | pending/available | 삭제 |
| Elastic IP | 전부 | (연결 해제 →) 해제. NAT 용 EIP 는 NAT 삭제 완료까지 기다린 뒤 해제 |
| EBS Volume | 미연결(available) | 삭제 |
| RDS / RDS Cluster | 전부 | 삭제 (최종 스냅샷 옵션) |
| S3 | 전부 | 객체·버전 전부 비운 뒤 버킷 삭제 |

삭제는 위 표 순서(의존성 순서)로 진행된다.

## 안전장치

- **Dry-run 이 기본값** — 체크를 풀어야 실제 삭제
- 실제 삭제 시 **계정 ID 를 직접 입력**해야 실행 버튼이 활성화
- 태그 `keep=true` 인 리소스는 선택 불가, 삭제 시에도 건너뜀
- 127.0.0.1 에만 바인딩 (외부 접근 불가)

## 토폴로지 (아키텍처 뷰)

- **Ctrl+Shift+T**: 게임처럼 테두리 없는 창으로 화면 전체(작업 표시줄 포함)를 덮고 토폴로지를 연다. Esc 로는 꺼지지 않는다.
- **Ctrl+Shift+Y**: 나가기 (원래 창 크기·위치로 복원)
- 리전(청록) > VPC(자홍) > AZ(연두) > 서브넷 > 리소스, S3 는 리전 상자 아래 "리전 서비스"
- 선: 피어링(주황), Transit Gateway(파랑 점선), 서브넷에 마우스를 올리면 그 라우트
- 이동: 화면 가장자리에 마우스 / 우클릭 꾹 누르고 끌기 / 드래그. 확대: 휠
- 우클릭: VPC·서브넷·인스턴스·인터넷 게이트웨이 만들기 메뉴 (실제 AWS 에 생성되고 요금이 발생할 수 있음)
- 브라우저 단축키(새로고침, 뒤로 등)는 앱 전체에서 막혀 있다

## 알아둘 것

- 삭제 보호(EC2 termination protection, RDS/ELB deletion protection)가 켜진 리소스는 실패로 표시된다. 콘솔에서 보호를 끈 뒤 다시 실행.
- Auto Scaling Group 에 속한 EC2 는 종료해도 ASG 가 새로 띄운다. EKS/ECS/Beanstalk 가 만든 리소스도 상위 서비스가 다시 만들 수 있다.
- 필요한 IAM 권한: 각 서비스의 `Describe*/List*` + 삭제 API (`ec2:TerminateInstances`, `ec2:DeleteNatGateway`, `ec2:ReleaseAddress`, `s3:DeleteObject*`, `s3:DeleteBucket`, `rds:DeleteDB*`, `elasticloadbalancing:DeleteLoadBalancer` 등). 권한 없는 리전/서비스는 경고로 표시된다.
