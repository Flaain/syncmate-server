export const getOtpTemplate = (otp: number, title: string) => `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"><meta name="x-apple-disable-message-reformatting"></head><body style="background-color:#fff;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,&#x27"><table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:37.5em;margin:0 auto;padding:0 20px"><tbody><tr style="width:100%"><td><h1 style="color:#1d1c1d;font-size:36px;font-weight:700;margin:30px 0;padding:0;line-height:42px">${title}</h1><p style="font-size:20px;line-height:28px;margin:16px 0;margin-bottom:30px">Your confirmation code is below - enter it in your open browser window and we&#x27;ll help you get signup.</p><table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f4f5;border-radius:4px;margin-bottom:30px;padding:40px 10px"><tbody><tr><td><p style="font-size:30px;line-height:24px;margin:16px 0;text-align:center;vertical-align:middle">${otp}</p></td></tr></tbody></table><p style="font-size:14px;line-height:24px;margin:16px 0;color:#000">If you didn&#x27;t request this email, there&#x27;s nothing to worry about, you can safely ignore it.</p><table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©${new Date().getFullYear()} Syncmate Technologies.<br><br>All rights reserved.</p></tr></tbody></table></td></tr></tbody></table></body></html>`;