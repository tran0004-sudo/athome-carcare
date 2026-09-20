// 집앞세차-앳홈 카케어 | 새 예약 → 관리자 기기로 웹 푸시 발송
//
// 배포:  supabase functions deploy notify-push --no-verify-jwt
// 필요한 환경변수 (Supabase 대시보드 → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  ← 기본 제공되므로 따로 넣지 않아도 됩니다
//
// Database Webhooks 에서 reservations 테이블 INSERT 시 이 함수를 호출하도록 연결합니다.

import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:tran0004@gmail.com";

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

Deno.serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    // Database Webhook 은 { type, table, record, old_record } 형태로 보냅니다.
    const row = payload.record ?? payload;

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
    return new Response(JSON.stringify({ ok: true, sent, removed, total: subs.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
