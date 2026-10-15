---
title: Queue Recovery Verification
---

# Queue recovery: controlled end-to-end verification

Tracks [issue #14](https://github.com/AA-Hermes/germes.bot/issues/14).

The automated test `tests/queue-recovery-flow.test.ts` exercises the state transitions with an in-memory queue and mocked OpenAI/Bitrix24. **It does not prove that GitHub Actions, Vercel, Neon and a real Bitrix24 portal work together.** The following is the required production/staging verification.

## Preconditions

- Use a dedicated test Bitrix24 dialog and a known test user. Obtain the real `conversation_id` and `user_id` from an existing legitimate test event; do not guess either value.
- Verify the correct Bitrix24 installation, Vercel deployment and Neon database are connected.
- `DATABASE_URL` must be configured on Vercel; `CRON_SECRET` must match the GitHub Actions secret. Never print either value.
- Ensure no other workers are processing the chosen event during the test. Use a unique `external_id` with a recognizable `recovery-e2e-` prefix.
- Run the test only when a controlled reply to that dialog is acceptable. Do not use a customer conversation.

## 1. Create one controlled pending event

Use the Neon SQL editor or a restricted database session. Substitute the **real** test dialog/user IDs and a unique external ID. This simulates an accepted webhook whose `waitUntil()` processor did not run, without adding a test-only production HTTP endpoint.

```sql
INSERT INTO incoming_event_queue
  (channel, external_id, conversation_id, user_id, text, status, delivery_status, available_at)
VALUES
  ('bitrix24', 'recovery-e2e-REPLACE-UNIQUE-ID',
   'REPLACE-REAL-TEST-DIALOG-ID', 'REPLACE-REAL-TEST-USER-ID',
   'Reply with: queue recovery verified', 'pending', 'pending', now())
RETURNING id, external_id, status, delivery_status, attempts, outbound_message_id;
```

**Important:** Do not use this insert against a branch/schema that requires additional security metadata such as `portal_domain` or `chat_type`. In that version, provide verified values for those columns, including the real originating portal domain and `private` chat type. Missing metadata must fail closed.

Immediately verify the record remains pending. Scheduled recovery runs every five minutes, so the observation window is short. For a deterministic pre-run observation, temporarily pause the scheduled recovery workflow and other consumers in a controlled test environment, then restore them afterward.

```sql
SELECT id, status, delivery_status, attempts, outbound_message_id
FROM incoming_event_queue
WHERE channel = 'bitrix24' AND external_id = 'recovery-e2e-REPLACE-UNIQUE-ID';
```

Expected: `pending / pending`, `attempts = 0`, `outbound_message_id IS NULL`.

## 2. Run recovery

In GitHub Actions, open **Queue Recovery** (`.github/workflows/queue-worker.yml`) and choose **Run workflow**, or wait for its scheduled run. Confirm the workflow succeeded and the protected `GET /api/queue/process` returned a successful response. Inspect only sanitized status codes and queue event metadata; do not paste authorization headers or credentials into issues.

The worker processes at most ten eligible rows per request. If the event is not claimed on the first run, check backlog and retry eligibility before drawing conclusions.

## 3. Verify delivery and final state

Confirm the expected response appears in the test Bitrix24 dialog. Then run:

```sql
SELECT id, status, delivery_status, attempts, outbound_message_id, last_error
FROM incoming_event_queue
WHERE channel = 'bitrix24' AND external_id = 'recovery-e2e-REPLACE-UNIQUE-ID';
```

Expected: `status = 'completed'`, `delivery_status = 'sent'`, non-null `outbound_message_id`, and no `last_error`. Verify the outbound ID corresponds to the delivered message. Record the GitHub Actions run URL, queue row ID, and outcome in issue #14 (not the secret or message content).

If the row is `failed / unknown`, **do not automatically resend**: outbound delivery may already have happened. Inspect Bitrix24 and queue state first.

## 4. Cleanup

Re-enable any paused worker/schedule. Remove only the specifically identified test row if retention policy allows; do not run broad deletion queries. No test-only endpoint, bypass flag, or production secret should remain.

**Completion criterion:** close issue #14 only after real GitHub Actions → Vercel → Neon → OpenAI → Bitrix24 delivery and final persisted state have been independently confirmed.
