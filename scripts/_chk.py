from pathlib import Path
t = Path("site-nav.js").read_text(encoding="utf-8")
i = t.find('openAuth("register")')
print("idx", i)
print(t[i-180:i+280])
print("--- counts ---")
print("mypage makeTop", t.count('makeTopAuthButton("마이페이지"'))
print("login makeTop", t.count('makeTopAuthButton("로그인"'))
