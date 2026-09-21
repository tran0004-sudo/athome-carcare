# 새 예약 푸시 알림 설정 가이드

앱을 꺼둔 상태에서도 새 예약 알림을 받기 위한 설정입니다.
아래 4단계를 순서대로 진행하세요. 한 번만 하면 됩니다.

---

## 1단계. 데이터베이스 준비

Supabase 대시보드 → **SQL Editor** → **New query**

저장소의 `push-subscriptions.sql` 내용을 붙여넣고 **Run**.

`push_subscriptions` 테이블이 만들어집니다. 관리자 기기 정보만 저장되며,
로그인한 관리자 외에는 접근할 수 없습니다.

---

## 2단계. 키 등록

Supabase 대시보드 → **Edge Functions** → **Secrets** (또는 Settings → Edge Functions)

아래 세 개를 추가합니다. 이름과 값을 정확히 그대로 넣으세요.

| 이름 | 값 |
|---|---|
| `VAPID_PUBLIC_KEY` | 새로 생성한 VAPID 공개키 |
| `VAPID_PRIVATE_KEY` | 새로 생성한 VAPID 비공개키 — **Supabase Secrets에만 입력** |
| `VAPID_SUBJECT` | `mailto:tran0004@gmail.com` |

> **보안 주의** — 이전 VAPID 비공개키가 공개 저장소에 포함된 적이 있으므로 그 키는 사용하지 마세요.
> 반드시 새 VAPID 키 쌍을 생성해 교체하고, PRIVATE KEY는 Supabase Secrets에만 저장하세요.
> 공개 저장소나 문서에는 PRIVATE KEY를 다시 넣지 마세요.

---

## 3단계. 함수 배포

두 가지 방법 중 편한 쪽을 고르세요.

### 방법 A — 대시보드에서 직접 (설치 불필요, 권장)

1. Supabase 대시보드 → **Edge Functions** → **Deploy a new function**
2. 함수 이름: `notify-push`
3. 편집창에 저장소의 `supabase/functions/notify-push/index.ts` 내용을 전부 붙여넣기
4. **Verify JWT** 옵션을 **끕니다** (Database Webhook이 호출해야 하므로)
5. **Deploy**

### 방법 B — CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref xejdhnwqqaamujkebvne
supabase functions deploy notify-push --no-verify-jwt
```

---

## 4단계. 예약 등록 시 자동 호출 연결

Supabase 대시보드 → **Database** → **Webhooks** → **Create a new hook**

| 항목 | 설정값 |
|---|---|
| Name | `new-reservation-push` |
| Table | `reservations` |
| Events | **Insert** 만 체크 |
| Type | **Supabase Edge Functions** |
| Edge Function | `notify-push` |
| Method | POST |

**Create webhook** 을 누르면 끝입니다.

---

## 마무리 — 기기 등록

1. 휴대폰 크롬에서 앱을 열고 **홈 화면에 추가**로 설치
2. 설치된 앱으로 들어가 관리자 로그인
3. 상단의 **🔕 알림 켜기** 버튼 누르기
4. 권한 허용 → "앱을 꺼두셔도 새 예약 알림이 옵니다" 메시지가 뜨면 성공

PC에서도 같은 방법으로 등록하면 양쪽 모두에 알림이 옵니다.

---

## 확인 방법

앱에서 테스트 예약을 하나 넣어보세요. 휴대폰을 잠그고 앱을 완전히 종료한
상태에서도 알림이 오면 정상입니다.

알림이 오지 않으면 Supabase 대시보드 → Edge Functions → `notify-push` →
**Logs** 에서 오류를 확인할 수 있습니다.

---

## 알아두실 점

- **iOS(아이폰)** 는 홈 화면에 설치한 앱에서만 푸시가 옵니다. 사파리로 그냥
  열어서는 알림이 오지 않습니다. iOS 16.4 이상이어야 합니다.
- **안드로이드** 는 설치 없이 크롬에서도 동작하지만, 설치하는 쪽이 안정적입니다.
- 기기를 바꾸시면 새 기기에서 다시 **알림 켜기** 를 눌러주세요.
- 오래 사용하지 않아 만료된 기기 등록은 자동으로 정리됩니다.
