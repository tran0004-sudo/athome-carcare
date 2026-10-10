# 카카오 로그인 설정 순서 (사장님용)

## 1. Supabase SQL 실행 (먼저!)
1. `database/20261010_kakao_member_link.sql` 파일을 연다.
2. 맨 위 `여기에_관리자_이메일@example.com` 을 **사장님 관리자 로그인 이메일**로 바꾼다.
3. Supabase → SQL Editor 에 전체를 붙여넣고 **한 번에 Run**. (오류가 나면 전체가 취소되어 안전하다.)

## 2. 카카오 개발자 사이트 (developers.kakao.com)
1. 내 애플리케이션 → 애플리케이션 추가 (앱 이름: 집앞세차 앳홈카케어)
2. 제품 설정 → **카카오 로그인 → 활성화 ON**
3. **Redirect URI** 에 입력: `https://xejdhnwqqaamujkebvne.supabase.co/auth/v1/callback`
4. 동의항목 → **닉네임**만 "필수/선택 동의"로 설정 (이메일·전화번호는 쓰지 않음)
5. 보안 → **Client Secret 생성** 후 "활성화"
6. 앱 키의 **REST API 키**와 위 Client Secret을 복사 (채팅에 붙여넣지 말 것)

## 3. Supabase 설정
1. Authentication → Providers → **Kakao ON**
   - Client ID = REST API 키 / Client Secret = 카카오 Client Secret
   - **Allow users without an email** 를 켠다 (닉네임만 받으므로)
2. Authentication → URL Configuration
   - Site URL: `https://tran0004-sudo.github.io/athome-carcare/`
   - Redirect URLs 에 같은 주소와 `https://tran0004-sudo.github.io/athome-carcare/**` 추가

## 4. 운영 방법
- 고객: 내 관리 → 카카오로 로그인 → 처음 한 번 휴대폰 번호 입력(연결 요청)
- 사장님: 관리자 → 회원 탭 맨 위 "카카오 회원 · 번호 연결 요청"에서 예약·계약 기록 유무를 보고 **승인**
- 승인된 번호의 예약·계약만 고객에게 보인다. 거절/연결 해제도 같은 화면에서 가능.
