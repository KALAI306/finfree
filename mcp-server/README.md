# FinFree MCP Server

Connect Claude, ChatGPT, and other AI tools to your FinFree financial data.

## Setup

```bash
cd mcp-server
npm install
```

## Connect to Claude Desktop

Edit `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "finfree": {
      "command": "node",
      "args": ["D:/Claude/new project/mcp-server/index.js"],
      "env": {
        "SUPABASE_URL": "your_supabase_url",
        "SUPABASE_ANON_KEY": "your_supabase_anon_key",
        "FINFREE_USER_ID": "your_user_id_from_supabase_auth"
      }
    }
  }
}
```

Restart Claude Desktop. You can now ask Claude things like:
- "What's my net worth?"
- "Show my spending this month"
- "Add a ₹500 food expense today"
- "How close am I to my Emergency Fund goal?"

## Available Tools

| Tool | Description |
|------|-------------|
| `financial_summary` | Full snapshot: net worth, accounts, monthly stats |
| `list_transactions` | Filter by type, category, date |
| `add_transaction` | Record income or expense |
| `bulk_add_transactions` | Add multiple at once |
| `delete_transaction` | Remove a transaction |
| `list_accounts` | All accounts with balances |
| `list_investments` | All investments with returns |
| `add_investment` | Add a new investment |
| `list_emis` | All active EMIs |
| `list_goals` | Goals with progress % |
| `add_goal` | Create a new goal |
| `update_goal_progress` | Update goal savings |
| `spending_breakdown` | Category breakdown for any month |

## Finding Your User ID

1. Go to FinFree Settings → your email is shown
2. In Supabase dashboard → Authentication → Users → copy your UUID
