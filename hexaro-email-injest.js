/**
 * Hexaro Mail Worker - Core SMTP Packet Forwarder with Smart OTP & Asset Extraction
 * Designed as a lightweight serverless router matching modern Jetpack Compose environments.
 */

export default {
  async email(message, env, ctx) {
    const rawEmail = await new Response(message.raw).text();
    const sender = message.from;
    const recipient = message.to;
    const subject = message.headers.get("subject") || "(No Subject)";

    console.log(`Receiving inbound email envelope. From: ${sender}, To: ${recipient}`);

    // 1. Isolate plain text bodies, links, and drops heavy MIME chunks
    const parsedBody = extractPlaintextAndLinks(rawEmail);

    // 2. Intelligent Real-time verification code/OTP search
    const otpCode = extractOtpCode(subject, parsedBody.text);
    if (otpCode) {
      console.log(`Identified verification code / OTP: ${otpCode}`);
    }

    // 3. Format webhook routing payload
    const webhookPayload = {
      id: crypto.randomUUID(),
      sender: sender,
      recipient: recipient,
      subject: subject,
      body: parsedBody.text,
      timestamp: Date.now(),
      otp_code: otpCode || null,
      links: parsedBody.links
    };

    // 4. Discover custom webhook destinations or fall back to default Firebase Webhook endpoint
    const webhookUrl = (env.FIREBASE_WEBHOOK_URL || "").trim().replace(/^["']|["']$/g, "").trim();

    if (webhookUrl) {
      console.log(`Dispatching webhook payload to configured endpoint: ${webhookUrl}`);
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(webhookPayload)
        });

        if (!response.ok) {
          throw new Error(`Firebase Webhook returned non-200 state: ${response.status} ${response.statusText}`);
        }

        console.log(`Successfully completed Firebase Webhook forwarding for email from ${sender}.`);
      } catch (error) {
        console.error(`Firebase Webhook forwarding failure: ${error.message}`);
      }
    }

    // 5. Direct Integration with OneSignal Push Notifications
    const onesignalApiKey = (env.ONESIGNAL_REST_API_KEY || "").trim().replace(/^["']|["']$/g, "").trim();
    const onesignalAppId = (env.ONESIGNAL_APP_ID || "eae94a0f-7594-41bd-8742-6c95cbbfd046").trim().replace(/^["']|["']$/g, "").trim();

    if (onesignalApiKey) {
      console.log("OneSignal push notification trigger active. Dispatching push notification...");
      try {
        let authHeader = onesignalApiKey;
        if (!authHeader.toLowerCase().startsWith("basic ")) {
          authHeader = `Basic ${authHeader}`;
        }

        const headingText = otpCode ? `🔑 OTP: ${otpCode} | ${sender}` : `New Mail: ${sender}`;
        const contentText = otpCode ? `Verification Code: ${otpCode} | Subject: ${subject || "(No Subject)"}` : (subject || "(No Subject)");

        const osPayload = {
          app_id: onesignalAppId,
          included_segments: ["All"],
          headings: { en: headingText },
          contents: { en: contentText },
          android_accent_color: "FF6200EE",
          small_icon: "ic_notification",
          large_icon: "ic_notification",
          data: {
            notification_type: "new_email",
            sender: sender,
            recipient: recipient,
            subject: subject || "(No Subject)",
            otp_code: otpCode,
            snippet: parsedBody.text.length > 120 ? `${parsedBody.text.substring(0, 117)}...` : parsedBody.text
          },
          android_group: "incoming_emails_group"
        };

        if (otpCode) {
          osPayload.buttons = [
            {
              id: "copy_otp",
              text: `Copy Code: ${otpCode}`,
              icon: "ic_notification"
            }
          ];
        }

        const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify(osPayload)
        });

        if (!osResponse.ok) {
          const osErrText = await osResponse.text();
          throw new Error(`OneSignal API returned error state: ${osResponse.status} ${osResponse.statusText} - ${osErrText}`);
        }

        const osData = await osResponse.json();
        console.log(`Successfully dispatched push notification via OneSignal. Notification ID: ${osData.id}`);
      } catch (error) {
        console.error(`OneSignal push notification dispatch failure: ${error.message}`);
      }
    }
  }
};

/**
 * Parses raw email body using regex to find body and extract any inline links (e.g., http/https attachments)
 * while dropping massive binary/multimedia MIME streams to keep the engine lightweight.
 */
function extractPlaintextAndLinks(rawEmail) {
  let text = "";
  let links = [];

  // Match URL links
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  let match;
  while ((match = urlRegex.exec(rawEmail)) !== null) {
    if (!links.includes(match[0])) {
      links.push(match[0]);
    }
  }

  // Basic MIME-Multipart stripper to isolate Content-Type: text/plain
  // If the email is single-part simple text, we grab the message after headers
  const parts = rawEmail.split(/\r?\n\r?\n/);
  if (parts.length > 1) {
    // Skip headers block (first block)
    const contentParts = parts.slice(1);
    const textBlocks = [];

    for (const block of contentParts) {
      // Filter out massive base64 or attachment blocks
      if (block.includes("Content-Type: text/plain") || !block.includes("Content-Transfer-Encoding: base64")) {
        // Clean multi-part headers from this sub-block if present
        const sanitizedBlock = block
          .replace(/Content-Type: [^\s]+/gi, "")
          .replace(/Content-Transfer-Encoding: [^\s]+/gi, "")
          .replace(/Content-Disposition: [^\s]+/gi, "")
          .replace(/--[a-zA-Z0-9+=_'-]+/g, "") // remove boundaries
          .trim();
        
        if (sanitizedBlock.length > 0 && sanitizedBlock.length < 15000) {
          textBlocks.push(sanitizedBlock);
        }
      }
    }

    text = textBlocks.join("\n\n").trim();
  }

  // Fallback if formatting was simple/flat
  if (!text) {
    text = rawEmail.length > 5000 ? rawEmail.substring(0, 5000) + "... (Truncated)" : rawEmail;
  }

  return { text, links };
}

/**
 * Drastically cleans HTML string to plain text.
 */
function stripHtml(html) {
  let text = html || "";
  // 1. Remove style blocks completely
  text = text.replace(/<style\b[^>]*>.*?<\/style>/gs, "");
  // 2. Remove script blocks completely
  text = text.replace(/<script\b[^>]*>.*?<\/script>/gs, "");
  // 3. Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // 4. Decode HTML entities
  text = text.replace(/&amp;/g, "&")
             .replace(/&nbsp;/g, " ")
             .replace(/&lt;/g, "<")
             .replace(/&gt;/g, ">")
             .replace(/&quot;/g, "\"")
             .replace(/&#39;/g, "'");
  return text;
}

/**
 * Checks if a code is likely styling or formatting noise.
 */
function isNoisyOrRepetitive(code) {
  if (!code) return true;
  const uniqueChars = new Set(code);
  if (uniqueChars.size <= 1) return true;
  
  if (code.length === 4) {
    const valInt = parseInt(code, 10);
    if (!isNaN(valInt) && valInt >= 1900 && valInt <= 2050) {
      return true;
    }
  }
  if (code.length === 8) {
    const firstFour = parseInt(code.substring(0, 4), 10);
    if (!isNaN(firstFour) && firstFour >= 1900 && firstFour <= 2050) {
      return true;
    }
  }
  return false;
}

/**
 * Decodes Quoted-Printable encoded string (e.g. removes soft line breaks and decodes =3D, etc.)
 */
function decodeQuotedPrintable(str) {
  if (!str) return "";
  // 1. Remove soft line breaks (equals sign followed by optional CR and mandatory LF)
  let decoded = str.replace(/=\r?\n/g, "");
  // 2. Decode hex-escaped characters (e.g. =3D or =20)
  decoded = decoded.replace(/=([0-9A-Fa-f]{2})/g, (match, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch (e) {
      return match;
    }
  });
  return decoded;
}

/**
 * Extracts numeric or alphanumeric verification codes (OTP) from email subject or body.
 */
function extractOtpCode(subject, body) {
  const decodedSubject = decodeQuotedPrintable(subject || "");
  const decodedBody = decodeQuotedPrintable(body || "");
  const cleanText = stripHtml(`${decodedSubject}\n${decodedBody}`);

  // 1. Clearly labeled codes on the same line
  const nearKeywords = /(?:code|otp|verify|verification|passcode|pin|one-time|security|activation|confirmation|passkey)[^\r\n]{0,30}\b([a-zA-Z0-9][-a-zA-Z0-9\s:]{2,10}[a-zA-Z0-9])\b/gi;
  let match;
  while ((match = nearKeywords.exec(cleanText)) !== null) {
    const rawCode = match[1].trim();
    const hasSpaces = rawCode.includes(" ") || rawCode.includes("\t");
    const cleanCode = rawCode.replace(/[-\s:]+/g, "");
    
    const isPureDigits = /^\d+$/.test(cleanCode);
    if (hasSpaces && !isPureDigits) {
      continue; // Reject alphanumeric mixed codes containing spaces (e.g. "555 This")
    }

    if (isPureDigits && cleanCode.length >= 4 && cleanCode.length <= 8) {
      if (!isNoisyOrRepetitive(cleanCode)) {
        return cleanCode;
      }
    } else if (!hasSpaces && cleanCode.length >= 4 && cleanCode.length <= 8) {
      const hasDigits = /\d/.test(cleanCode);
      const isUpper = cleanCode === cleanCode.toUpperCase();
      const isLower = cleanCode === cleanCode.toLowerCase();
      const noise = ["that", "this", "your", "from", "with", "have", "here", "click", "about", "html", "class", "style", "span", "div", "charset", "email"];
      
      if ((hasDigits || isUpper) && !isLower && !noise.includes(cleanCode.toLowerCase()) && !isNoisyOrRepetitive(cleanCode)) {
        return cleanCode;
      }
    }
  }

  // 2. Space or hyphen separated digits like "666-555" or "6 6 6 5 5 5" or "6 6 6 - 5 5 5"
  const separatedDigitsRegex = /\b(\d(?:[-\s]?\d){3,7})\b/g;
  const separatedMatches = cleanText.match(separatedDigitsRegex);
  if (separatedMatches) {
    for (const rawMatch of separatedMatches) {
      const cleanCode = rawMatch.replace(/[-\s]+/g, "");
      if (cleanCode.length >= 4 && cleanCode.length <= 8) {
        if (!isNoisyOrRepetitive(cleanCode)) {
          return cleanCode;
        }
      }
    }
  }

  // 3. Isolated consecutive digits of length 5 to 8
  const isolatedDigits = /\b(\d{5,8})\b/g;
  const digitMatches = cleanText.match(isolatedDigits);
  if (digitMatches) {
    for (const code of digitMatches) {
      if (!isNoisyOrRepetitive(code)) {
        return code;
      }
    }
  }

  // 4. Isolated consecutive 4 digits of length 4 (check if not year)
  const isolatedFourDigits = /\b(\d{4})\b/g;
  const fourDigitMatches = cleanText.match(isolatedFourDigits);
  if (fourDigitMatches) {
    for (const code of fourDigitMatches) {
      if (!isNoisyOrRepetitive(code)) {
        return code;
      }
    }
  }

  return null;
                            }
