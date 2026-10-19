---
title: Queue Recovery Verification
---

# Queue recovery: controlled end-to-end verification

Tracks [issue #14](https://github.com/AA-Hermes/germes.bot/issues/14).

The automated test `tests/queue-recovery-flow.test.ts` exercises the state transitions with an in-memory queue and mocked OpenAI/Bitrix24. **It does not prove that GitHub Actions, Vercel, Neon and a real Bitrix24 portal work together.** The following is the required **production-only** verification. The existing GitHub Actions recovery workflow targets `https://germesbot.vercel.app/api/queue/process` and does not support staging. Never use a staging database or deployment with this workflow.

## Preconditions

- Use a dedicated test Bitrix24 dialog and a known test user. Obtain the real `conversation_id` and `user_id` from an existing legitimate test event; do not guess either value.
- Verify the correct Bitrix24 installation, Vercel deployment and Neon database are connected.
- Verify the production deployment at `https://germesbot.vercel.app` uses the intended production Neon database and Bitrix24 test dialog. The GitHub Actions recovery workflow targets this URL, not a staging deployment.
- `DATABASE_URL` must be configured on production Vercel; `CRON_SECRET` must match the GitHub Actions secret. Never print either value.
- Confirm `OPENAI_API_KEY` is configured for the production deployment and that the active LLM provider is OpenAI, not the automatic `EchoLLMProvider` fallback. Check configuration without revealing the key. A successful Bitrix24 reply or queue status alone is **not** evidence that OpenAI ran.
- Use a unique `external_id` with a recognizable `recovery-e2e-` prefix. The production scheduler and webhook background workers may run concurrently; do not assume exclusive access or pause the production worker merely to make the test deterministic.
- Run the test only when a controlled reply to that dialog is acceptable. Do not use a customer conversation.

## Safe preflight: confirm active portal and bot registration

Before inserting a test event, run this **read-only** query against the production Neon database. It returns only the installation domain and whether the bot ID is present; it does **not** expose access tokens, refresh tokens, or the application token.

```sql
SELECT
  installation->>'domain' AS portal_domain,
  installation->>'memberId' AS portal_member_id,
  (bot_id IS NOT NULL) AS bot_registered
FROM integration_state
WHERE integration_key = 'bitrix24';
```

Require exactly one row, a non-empty portal domain matching the **verified originating test event**, and `bot_registered = true`. Confirm the dialog is private and the test user is authorized. If any check fails, **stop** rather than inserting a queue row. Do not publish the member ID or other portal metadata in a public issue; record only that the checks passed.

## 1. Create one controlled pending event

Use the Neon SQL editor or a restricted database session. Substitute the **real** test dialog/user IDs, originating portal domain, and a unique external ID. Confirm the domain against the current `integration_state.installation` and the originating Bitrix24 event; do not guess it. This simulates an accepted webhook whose `waitUntil()` processor did not run, without adding a test-only production HTTP endpoint.

```sql
INSERT INTO incoming_event_queue
  (channel, chat_type, portal_domain, external_id, conversation_id, user_id, text, status, delivery_status, available_at)
VALUES
  ('bitrix24', 'private', 'REPLACE-VERIFIED-PORTAL-DOMAIN',
   'recovery-e2e-REPLACE-UNIQUE-ID', 'REPLACE-REAL-TEST-DIALOG-ID', 'REPLACE-REAL-TEST-USER-ID',
   'Reply with: queue recovery verified', 'pending', 'pending', now())
RETURNING id, external_id, status, delivery_status, attempts, outbound_message_id;
```

**Important:** The current production worker requires `portal_domain` to match the active Bitrix24 installation. Use `chat_type = 'private'` only for a verified private test dialog; both values must reflect the originating event. Do not execute the example with placeholder values or missing metadata. A mismatched portal must fail closed.

Immediately query the record. Scheduled recovery runs every five minutes, so it may already be claimed or completed before this observation. **Do not disable the production recovery workflow or other consumers for this test.** If the row is no longer pending, record the timing and relevant worker logs; do not reset its state or insert a duplicate message to force a screenshot. To prove the initial pending state deterministically, perform that part in a separate isolated environment; the existing production-only GitHub workflow cannot be used to process staging rows.

```sql
SELECT id, status, delivery_status, attempts, outbound_message_id
FROM incoming_event_queue
WHERE channel = 'bitrix24' AND external_id = 'recovery-e2e-REPLACE-UNIQUE-ID';
```

Expected if observed before the scheduler: `pending / pending`, `attempts = 0`, `outbound_message_id IS NULL`. A concurrent worker may advance the row; use timestamps and logs to establish the actual sequence.

## 2. Run recovery

In GitHub Actions, open **Queue Recovery** (`.github/workflows/queue-worker.yml`) and choose **Run workflow**, or wait for its scheduled run. Confirm the workflow succeeded and the protected **production** `GET https://germesbot.vercel.app/api/queue/process` returned a successful response. A staging queue cannot be verified by this workflow. Inspect only sanitized status codes and queue event metadata; do not paste authorization headers or credentials into issues.

The worker processes at most ten eligible rows per request. A successful GitHub Actions run alone does not prove the test row was claimed: correlate the specific `external_id` and queue row ID with the production worker logs and final database state. If the event is not claimed on the first run, check backlog and retry eligibility before drawing conclusions.

## 3. Verify delivery and final state

Confirm the expected response appears in the test Bitrix24 dialog. Independently verify sanitized production application logs contain `QUEUED_EVENT_COMPLETED` for the **exact** test `queueId` and `externalId`, with `provider: 'openai'` (and not `provider: 'echo'` or `fallback`). This log contains provider and model alongside the queue ID, so another message in the same conversation cannot satisfy this check. A nearby `WORKFLOW_MESSAGE_COMPLETED` log alone is insufficient. Do not expose message text, credentials, or CRM records. If provider identity cannot be confirmed, the E2E acceptance criterion is **not met** even when the queue row is `completed / sent`. Then run:

```sql
SELECT id, status, delivery_status, attempts, outbound_message_id, last_error
FROM incoming_event_queue
WHERE channel = 'bitrix24' AND external_id = 'recovery-e2e-REPLACE-UNIQUE-ID';
```

Expected: `status = 'completed'`, `delivery_status = 'sent'`, non-null `outbound_message_id`, and no `last_error`. Verify the outbound ID corresponds to the delivered message. Record the GitHub Actions run URL, queue row ID, sanitized OpenAI-provider evidence, and outcome in issue #14 (not the secret or message content).

If the row is `failed / unknown`, **do not automatically resend**: outbound delivery may already have happened. Inspect Bitrix24 and queue state first.

## 4. Cleanup

Do not pause or reconfigure production schedules. Remove only the specifically identified test row if retention policy allows; do not run broad deletion queries. No test-only endpoint, bypass flag, or production secret should remain.

**Completion criterion:** close issue #14 only after real **production** GitHub Actions → Vercel → Neon → **verified OpenAI provider** → Bitrix24 delivery and final persisted state have been independently confirmed.
