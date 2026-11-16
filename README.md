# Qaroshi Translator

**[Launch the translator website](https://sparklecatdev.github.io/qaroshi-translator/)** · [Source repository](https://github.com/sparklecatdev/qaroshi-translator)

The GitHub *repository* page normally shows this README. The **GitHub Pages** address above is the actual app, served from the root-level `index.html`. It loads the 30,001-word source snapshot from the seven pinned `.snapshot/` archive parts, verifies its SHA-256, and caches files for offline use.

A source-linked, offline-first English ↔ Qaroshi translator, built as a standalone second project. Uses the complete **30,001-word Standard 8.0 editioned lexicon**, 4,383 controlled bilingual examples, 25 generalized verb frames, 400 verb audit records, and all 16 resonance markers. No ads or analytics.

**Why it’s careful:** Most constructed-language datasets do not license unrestricted open-domain translations. The app distinguishes four outcomes:

| Result | Meaning |
|---|---|
| **Documented** | Exact source-aligned bilingual example, with source IDs and possible variants |
| **Dictionary** | Word-level gloss, not a full-sentence translation |
| **Provisional** | A narrowly restricted rule-based sentence composition, not independently reviewed |
| **Unresolved** | Unsupported structure or sense; the app provides related references without hallucinating a full answer |

An optional server-side AI draft mode can suggest difficult sentences with source evidence, but **AI output is explicitly unverified**. It cannot replace grammar validation, lexicon review or human comprehension. Standard 8.3 proposals remain editorial candidates, not authoritative translations.

## Try locally

Requirements: Node.js 20+ and Python 3.10+ (standard library only). No npm packages, no account, no cloud service required.

```bash
npm test
npm start
```

Visit **http://127.0.0.1:4173**. The complete dictionary and controlled-example corpus are restored locally from the pinned, checksum-verified snapshot on first run. After a successful first load, the PWA service worker caches accessed data for offline use. `npm run build` creates a static site in `dist/` suitable for GitHub Pages or any static host. Do not open `index.html` directly as `file://`; a local HTTP server is needed for fetch and offline caching.

### Publish in its own repo

The app source is published in [sparklecatdev/qaroshi-translator](https://github.com/sparklecatdev/qaroshi-translator). Clone the repository, then run `npm test` and `npm start`. The pinned 30,001-word data snapshot is automatically reassembled from seven checked-in binary chunks before testing or building; the integrity checksum is verified before extraction. No GitHub API key or network download is needed for the snapshot.

GitHub Pages is currently configured for **Deploy from a branch: `main` / `(root)`**. The root-level site entry point handles this automatically. A separate workflow can deploy the prebuilt site if you later switch Pages to **GitHub Actions**; that optional workflow is manual-only until you change the Pages source. Neither deployment mode exposes or runs the optional AI service; deploy that separately if desired. Before making the repository public, select a license or obtain rights clearance for the Qaroshi source-derived content; see [LICENSE_NOTICE.md](LICENSE_NOTICE.md).

### Optional AI-assisted drafts

The app works fully offline without this. To enable open-ended assisted drafting locally, configure the following **server-side environment variables**, then start `npm start`:

```bash
export AI_MODEL='your-compatible-model'
export AI_API_KEY='your-provider-api-key'
export AI_API_URL='https://api.openai.com/v1/chat/completions'
npm start
```

The `AI draft` button appears only when configured. The app asks before sending any text to the provider. API keys are never accepted in the browser. The HTTP server binds to localhost by default, caps request sizes, limits AI drafting requests, and warns when a draft uses unknown Qaroshi roots. Do not expose the Node service publicly without additional authentication and production rate limiting.

## What's included

- **Translate:** automatic direction detection, resonance selection, exact and restricted compositional translation, bilingual source variants, IPA, morphological analysis, copy/save/history.
- **Dictionary:** full 30,001-entry searchable editioned lexicon, parts of speech, pronunciation, semantic caveats and source labels.
- **Guide:** practical grammar patterns, cases, tense/modal slots and evidence limitations.
- **Server:** zero-dependency local preview and optional provider-compatible draft endpoint.
- **PWA:** installable offline-first static experience, mobile responsive and light/dark modes.
- **Tests:** deterministic source-data, morphology, documented-example, restricted-translation, evidence abstention and output compatibility checks.

## Source synchronization and provenance

`public/data/` is a pinned, self-contained snapshot built from the owner's **Qaroshi 21–23 Complete Release** and **Unified Standard 8 Additive Patch** using:

```bash
python3 scripts/build_data.py \
  --release-zip /path/to/Qaroshi_21_23_Complete_Release.zip \
  --standard8-zip /path/to/Qaroshi_Unified_Standard_8_Additive_Patch.zip
npm test
npm run build
```

The source member hashes are in `public/data/meta.json`, and data counts are checked on every build. The old frozen 30,000-word baseline and the Standard 8 additional determiner `nëgëra` are not silently changed. No unreviewed candidate word forms from later editions are introduced. The original repository is [sparklecatdev/qaroshi](https://github.com/sparklecatdev/qaroshi).

## Limits

This is a **complete installable translator application**, but it is **not yet a validated full-coverage machine translator**. Arbitrary nested, figurative and highly technical language will frequently be unresolved in offline mode. The exact example corpus is controlled/editorial and does not constitute speaker-attested natural use. Incorrect English/Qaroshi sense substitution is intentionally blocked rather than hidden. Use [Qaroshi Standard 8.0](https://github.com/sparklecatdev/qaroshi/blob/main/docs/standard_8/grammar.md) and the [8.1 amendment](https://github.com/sparklecatdev/qaroshi/blob/main/docs/standard_8/AMENDMENT_8_1_EMBEDDED_POLAR.md) for adjudicating new constructions.
