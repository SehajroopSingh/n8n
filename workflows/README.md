# n8n Workflows

Example workflows you can import into n8n.

## How to Import

1. Run n8n: `pnpm dev` or `npx n8n`
2. Open http://localhost:5678
3. Go to **Workflows** → **Import from File** (or drag & drop)
4. Select a `.json` file from this folder

## Workflows

### `webhook-to-slack-and-sheets.json`

**Flow:** Webhook → Format Data → Slack → Google Sheets → Respond to Webhook

When a webhook is called, this workflow:
1. Extracts the payload (supports `body.message` or raw body)
2. Sends a notification to Slack
3. Appends the data to a Google Sheet
4. Returns a JSON response to the caller

**Setup required:**
- **Slack:** Add credentials, select a channel
- **Google Sheets:** Add credentials, select spreadsheet & sheet
- Create a Google Sheet with column headers: `message`, `timestamp`, `payload`

**Test the webhook:**
```bash
curl -X POST http://localhost:5678/webhook/incoming-data \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from webhook!"}'
```

### `simple-manual-workflow.json`

**Flow:** Manual Trigger → Set Data → Code

A minimal workflow that:
1. Runs when you click "Execute workflow"
2. Sets greeting and timestamp
3. Processes data in a Code node

No credentials needed. Good for testing the editor.
