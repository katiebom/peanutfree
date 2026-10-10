#!/bin/zsh
# 주간 가져오기 + 기계 검증 (읽기·로컬 파일 쓰기만. Firestore 에는 쓰지 않는다)
#  1) Gemini 시트 → data/candidates/   (장부와 대조해 new/changed/unchanged 표시)
#  2) 기계 검증 → data/verified/       (이미 검증한 행은 장부 결과를 재사용, 다시 열지 않음)
#  3) Claude 확인 대기 목록 출력
cd "$HOME/Downloads/PeanutFreeNew" || exit 1
SHEET_ID="${SHEET_ID:-1OhShgFwJxwsZpUYnUkxu7vTazIPx4fIwbd9Foil0o0E}"
NODE=/usr/local/bin/node
$NODE scripts/import-gemini-sheet.mjs --sheet "$SHEET_ID" || exit 1
F=$(ls -t data/candidates/gemini-*.json | head -1)
$NODE scripts/check-sources.mjs "$F" --include-unverified
$NODE scripts/ledger.mjs status
$NODE scripts/ledger.mjs pending
