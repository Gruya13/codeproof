# Rejected and unresolved findings

Commit: 9ff342479591ca5a43cb30000195bcf55c1bbed9  |  run-id: e9ead2e30ee9115d

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-001 - isPassportNumber uses wrong case for regex lookup

**Claim:** Lowercase countryCode passes the 'in' check via toUpperCase() but the subsequent lookup uses the original case, so passportRegexByCountryCode[countryCode] is undefined and .test() throws.

**Reason:** citation range expects 8 non-blank lines but snippet has 7

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
