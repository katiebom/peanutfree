#!/usr/bin/env python3
# 표준입력으로 {to, subject, text, html} JSON 을 받아 Gmail SMTP 로 보낸다.
# 필요한 환경변수: GMAIL_USER, GMAIL_APP_PASSWORD (Google 계정 > 보안 > 앱 비밀번호 16자리)
import json, os, smtplib, sys
from email.message import EmailMessage

msg_in = json.load(sys.stdin)
user = os.environ.get('GMAIL_USER')
pw = os.environ.get('GMAIL_APP_PASSWORD')
if not user or not pw:
    sys.exit('GMAIL_USER / GMAIL_APP_PASSWORD 가 없습니다 (.env.local 확인)')

m = EmailMessage()
m['From'] = f"PeanutFree <{user}>"
m['To'] = msg_in['to']
m['Subject'] = msg_in['subject']
m.set_content(msg_in.get('text', ''))
if msg_in.get('html'):
    m.add_alternative(msg_in['html'], subtype='html')

with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=30) as smtp:
    smtp.login(user, pw)
    smtp.send_message(m)
print('sent')
