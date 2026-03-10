# Content Moderation

## Text Toxicity (Detoxify)

### Overview
Text moderation uses **Detoxify** (open source) when available; otherwise it falls back to the local keyword-based checker.

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `DETOXIFY_TOXICITY_THRESHOLD` | `0.5` | Score threshold. Any attribute (toxicity, severe_toxicity, etc.) above this = unsafe. Range 0–1. |

### Detoxify (Open Source)
- **Cost:** Free. Runs locally, no API keys required.
- **Models:** Uses `multilingual` for international support.
- **Production:** Suitable for production. Runs on CPU/GPU. No external API calls.

### Fallback Behavior
- **Detoxify unavailable:** Uses local keyword-based detection (violence, hate speech, spam) — always free, works offline.
- **Detoxify failure:** Automatically falls back to the keyword-based checker. No user-facing errors.

### `check_text_toxicity(text)` Return Format
```python
{
    "safe": bool,           # True if content passes moderation
    "scores": {             # Detoxify scores when used; empty for keyword fallback
        "toxicity": 0.12,
        "severe_toxicity": 0.05,
        "identity_attack": 0.02,
        "insult": 0.15,
        "profanity": 0.08,
        "threat": 0.01
    },
    "source": "detoxify" | "keyword",
    "checked_at": "ISO8601"
}
```

### Integration Points
- Post creation: `POST /social/posts`
- Comment creation: `POST /social/posts/{post_id}/comments`
- Comment edit: `PUT /social/comments/{comment_id}`
