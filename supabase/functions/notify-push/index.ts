// 집앞세차-앳홈 카케어 | 새 예약 → 관리자 기기로 웹 푸시 발송
//
// 배포:  supabase functions deploy notify-push --no-verify-jwt
//        (Database Webhook 이 호출하므로 JWT 확인은 끄고, 대신 아래 비밀 헤더로 잠급니다)
// 필요한 환경변수 (Supabase 대시보드 → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   NOTIFY_WEBHOOK_SECRET  ← Webhook 의 HTTP Header "x-webhook-secret" 값과 똑같이 넣기
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  ← 기본 제공되므로 따로 넣지 않아도 됩니다
//
// Database Webhooks 에서 reservations 테이블 INSERT 시 이 함수를 호출하도록 연결합니다.
// 비밀 헤더가 없거나 다르면 401, reservations INSERT 가 아니면 알림 없이 끝냅니다.

import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:tran0004@gmail.com";
const WEBHOOK_SECRET = Deno.env.get("NOTIFY_WEBHOOK_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// 길이까지 포함해 항상 같은 시간이 걸리는 비교 (글자를 하나씩 맞춰 보는 공격 방지)
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  // 1) 비밀 헤더 확인 — Secret 이 아직 없으면 아무 호출도 받지 않음 (잠긴 상태가 기본)
  if (!WEBHOOK_SECRET) {
    console.error("NOTIFY_WEBHOOK_SECRET 이 설정되지 않아 호출을 거절했습니다.");
    return json(401, { ok: false, error: "unauthorized" });
  }
  if (req.method !== "POST" || !safeEqual(req.headers.get("x-webhook-secret") ?? "", WEBHOOK_SECRET)) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    // 2) Database Webhook 은 { type, table, schema, record, old_record } 형태로 보냅니다.
    //    reservations 테이블의 새 예약(INSERT)일 때만 알림을 보냅니다.
    if (payload?.type !== "INSERT" || payload?.table !== "reservations" || !payload?.record) {
      return json(200, { ok: true, skipped: true });
    }
    const row = payload.record;

    const title = "새 예약이 접수되었습니다";
    const body = [
      [row.customer_name, row.car_model].filter(Boolean).join(" · "),
      [row.apartment, row.service_type].filter(Boolean).join(" · "),
      [row.preferred_date, row.preferred_time?.slice?.(0, 5)].filter(Boolean).join(" "),
    ].filter(Boolean).join("\n") || "관리자 화면에서 확인해주세요.";

    const subsRes = await rest("push_subscriptions?select=endpoint,p256dh,auth");
    if (!subsRes.ok) throw new Error(await subsRes.text());
    const subs = await subsRes.json();

    const message = JSON.stringify({ title, body, url: "./" });

    const results = await Promise.allSettled(
      subs.map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
        )
      ),
    );

    // 만료된 구독(404/410)은 정리
    let removed = 0;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "rejected") {
        const code = (r.reason as any)?.statusCode;
        if (code === 404 || code === 410) {
          await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(subs[i].endpoint)}`, {
            method: "DELETE",
          });
          removed += 1;
        } else {
          console.error("push 실패", code, (r.reason as any)?.body);
        }
      }
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return json(200, { ok: true, sent, removed, total: subs.length });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: "internal error" });
  }
});
