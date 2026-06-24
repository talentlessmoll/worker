/**
 * Cloudflare Email Worker for Hexaro Mail Engine
 * Domain Context: hexaro.name.ng
 * Intercepts all inbound email traffic, filters attachments to inline links,
 * and securely forwards metadata to the Firebase Cloud Function Webhook.
 */

export default {
  async email(message, env, ctx) {
    // 1. Core Header and Routing Metadata Extraction
    let sender = message.from;
    const fromHeader = message.headers.get("from") || message.headers.get("From");
    if (fromHeader) {
      const emailMatch = fromHeader.match(/<([^>]+)>/);
      if (emailMatch && emailMatch[1]) {
        sender = emailMatch[1].trim();
      } else {
        sender = fromHeader.trim().replace(/^["']|["']$/g, "").trim();
      }
    }
    const recipient = message.to;
    const subject = message.headers.get("subject") || "(No Subject)";
    const dateStr = message.headers.get("date") || new Date().toISOString();

    // 2. Read raw email payload to extract bodies and links
    let rawEmail;
    try {
      const rawResponse = new Response(message.raw);
      rawEmail = await rawResponse.text();
    } catch (e) {
      console.error("Failed to read raw email body stream:", e);
      rawEmail = "";
    }

    // 3. Lightweight Parsing to extract plaintext email content and filter attachments
    // We parse basic headers and content. For a production-ready light parser,
    // we search for the plaintext parts and extract URLs (inline link attachments).
    const parsedBody = extractPlaintextAndLinks(rawEmail);

    // Parse a guaranteed safe numeric timestamp (milliseconds) to prevent NaN serialization issues
    let timestampMs = Date.now();
    if (dateStr) {
      try {
        const parsed = new Date(dateStr).getTime();
        if (!isNaN(parsed)) {
          timestampMs = parsed;
        }
      } catch (e) {}
    }

    // 4. Construct Payload
    const webhookPayload = {
      sender: sender,
      recipient: recipient,
      subject: subject,
      body: parsedBody.text,
      links: parsedBody.links,
      timestamp: new Date(timestampMs).toISOString()
    };

    // Extract OTP Code if any
    const otpCode = extractOtpCode(subject, parsedBody.text);

    // 5. Route to Target Backends (Supabase and/or Firebase) with sanitization
    const supabaseUrl = (env.SUPABASE_URL || "").trim().replace(/^["']|["']$/g, "").trim();
    const supabaseKey = (env.SUPABASE_ANON_KEY || "").trim().replace(/^["']|["']$/g, "").trim();
    const webhookUrl = (env.FIREBASE_FUNCTION_URL || "").trim().replace(/^["']|["']$/g, "").trim();
    const workerSecret = (env.WORKER_SECRET || "").trim().replace(/^["']|["']$/g, "").trim();

    console.log(`Routing context - Recipient: ${recipient}, Sender: ${sender}, Subject: ${subject}`);
    console.log(`Configuration diagnostic - Supabase URL: "${supabaseUrl ? supabaseUrl.substring(0, 15) + "..." : ""}" (exists: ${!!supabaseUrl}), Supabase Key exists: ${!!supabaseKey}`);

    if (!supabaseUrl && !webhookUrl) {
      console.error("Configuration missing: Neither SUPABASE_URL nor FIREBASE_FUNCTION_URL is defined. Please configure at least one backend in your Worker environment variables.");
      return;
    }

    // Direct Integration with Supabase (Free & does not require serverless cloud functions/billing plans)
    if (supabaseUrl && supabaseKey) {
      const maskedKey = supabaseKey.length > 8 ? `${supabaseKey.substring(0, 4)}...${supabaseKey.substring(supabaseKey.length - 4)}` : "invalid";
      console.log(`Direct Supabase integration active. Host: ${supabaseUrl}, Key: ${maskedKey}`);
      console.log("Stashing mail payload directly in table 'received_emails'...");
      try {
        const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, "");
        const supabaseEndpoint = `${cleanSupabaseUrl}/rest/v1/received_emails`;
        
        const emailId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 10);
        const supabasePayload = {
          id: emailId,
          sender: sender,
          recipient: recipient,
          subject: subject,
          body: parsedBody.text,
          timestamp: timestampMs,
          serialized_links: parsedBody.links.join(",")
        };

        let response = await fetch(supabaseEndpoint, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(supabasePayload)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Supabase REST insert returned status ${response.status} with numeric timestamp. Retrying with ISO-8601 string timestamp...`);
          
          const retryPayload = {
            ...supabasePayload,
            timestamp: new Date(timestampMs).toISOString()
          };

          response = await fetch(supabaseEndpoint, {
            method: "POST",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal"
            },
            body: JSON.stringify(retryPayload)
          });

          if (!response.ok) {
            const retryErrText = await response.text();
            throw new Error(`Supabase REST retry also failed: ${response.status} ${response.statusText} - ${retryErrText}`);
          }
        }

        console.log(`Successfully stored mail in Supabase 'received_emails' table. ID: ${emailId}`);
      } catch (error) {
        console.error(`Direct Supabase sync routing failure: ${error.message}`);
      }
    }

    // Secondary Integration with Firebase Webhook (Optional - requires Blaze billing plan for Firebase cloud functions)
    if (webhookUrl && workerSecret) {
      console.log("Firebase webhook forwarding active. Sending HTTP POST request...");
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Worker-Secret": workerSecret
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

    // 6. Direct Integration with OneSignal Push Notifications (Optional)
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
            otp_code: otpCode || undefined,
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
 * Parses raw email body using robust MIME parsing, extracting plaintext, HTML parts,
 * and inline hyperlinks, while filtering out attachments and heavy base64 data.
 */
function extractPlaintextAndLinks(rawEmail) {
  let text = "";
  let links = [];

  // Match URL links
  const urlRegex = /https?:\/\/[^\s"'<>|\[\]()]+/g;
  let match;
  while ((match = urlRegex.exec(rawEmail)) !== null) {
    if (!links.includes(match[0])) {
      links.push(match[0]);
    }
  }

  // 1. Extract boundary parameters from Content-Type headers
  const boundaries = [];
  const boundaryMatches = rawEmail.matchAll(/boundary=["']?([^"'\s;]+)["']?/gi);
  for (const m of boundaryMatches) {
    if (!boundaries.includes(m[1])) {
      boundaries.push(m[1]);
    }
  }

  let textParts = [];
  let htmlParts = [];

  if (boundaries.length > 0) {
    // Escaping boundaries for safety in regex creation
    const escapedBoundaries = boundaries.map(b => b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
    const boundaryRegex = new RegExp(`\r?\n--(?:${escapedBoundaries})(?:--)?\r?\n`, 'g');
    
    // Split the raw email by any boundary marker found in the email
    const parts = rawEmail.split(boundaryRegex);
    // Ignore parts[0] as it is the main outer header block
    const partsToProcess = parts.slice(1);

    for (const part of partsToProcess) {
      if (!part.trim()) continue;

      // Each part is separated into part headers and body by a double newline
      const doubleNewlineIndex = part.search(/\r?\n\r?\n/);
      if (doubleNewlineIndex === -1) continue;

      const partHeadersText = part.substring(0, doubleNewlineIndex);
      const partBodyText = part.substring(doubleNewlineIndex).trim();

      // Parse part headers to handle Content-Type and Content-Transfer-Encoding
      const partHeaders = {};
      const headerLines = partHeadersText.split(/\r?\n/);
      let currentHeader = "";
      for (const line of headerLines) {
        if (/^\s/.test(line)) {
          currentHeader += " " + line.trim();
        } else {
          if (currentHeader) {
            const colonIdx = currentHeader.indexOf(":");
            if (colonIdx !== -1) {
              const name = currentHeader.substring(0, colonIdx).trim().toLowerCase();
              const val = currentHeader.substring(colonIdx + 1).trim();
              partHeaders[name] = val;
            }
          }
          currentHeader = line.trim();
        }
      }
      if (currentHeader) {
        const colonIdx = currentHeader.indexOf(":");
        if (colonIdx !== -1) {
          const name = currentHeader.substring(0, colonIdx).trim().toLowerCase();
          const val = currentHeader.substring(colonIdx + 1).trim();
          partHeaders[name] = val;
        }
      }

      const contentType = partHeaders["content-type"] || "";
      const contentTransferEncoding = partHeaders["content-transfer-encoding"] || "";
      const contentDisposition = partHeaders["content-disposition"] || "";

      // Skip actual file attachments
      if (contentDisposition.toLowerCase().includes("attachment")) {
        continue;
      }

      // Check if it's text or html
      const isPlain = contentType.toLowerCase().includes("text/plain");
      const isHtml = contentType.toLowerCase().includes("text/html");
      if (!isPlain && !isHtml && contentType) {
        // If content-type is set but it is neither plain nor HTML (e.g. image, octet-stream), skip it
        continue;
      }

      let decodedBody = partBodyText;
      if (contentTransferEncoding.toLowerCase().includes("base64")) {
        try {
          const cleanedBase64 = partBodyText.replace(/\s+/g, "");
          const decoded = atob(cleanedBase64);
          try {
            decodedBody = new TextDecoder("utf-8").decode(Uint8Array.from(decoded, c => c.charCodeAt(0)));
          } catch (e) {
            decodedBody = decoded;
          }
        } catch (e) {
          console.error("Failed to decode base64 MIME part:", e);
          continue;
        }
      } else if (contentTransferEncoding.toLowerCase().includes("quoted-printable")) {
        decodedBody = decodeQuotedPrintable(partBodyText);
      }

      // Collect part bodies up to a generous limit (500KB per part) to keep memory safe
      if (decodedBody.trim().length > 0 && decodedBody.trim().length < 500000) {
        if (isHtml) {
          htmlParts.push(decodedBody.trim());
        } else {
          textParts.push(decodedBody.trim());
        }
      }
    }
  }

  // Fallback for simple flat emails with no boundaries
  if (textParts.length === 0 && htmlParts.length === 0) {
    const doubleNewlineIndex = rawEmail.search(/\r?\n\r?\n/);
    if (doubleNewlineIndex !== -1) {
      const mainBody = rawEmail.substring(doubleNewlineIndex).trim();
      
      const cteMatch = rawEmail.match(/content-transfer-encoding:\s*([^\s;]+)/i);
      const cte = cteMatch ? cteMatch[1].toLowerCase() : "";
      
      let decodedBody = mainBody;
      if (cte.includes("quoted-printable")) {
        decodedBody = decodeQuotedPrintable(mainBody);
      } else if (cte.includes("base64")) {
        try {
          const cleanedBase64 = mainBody.replace(/\s+/g, "");
          const decoded = atob(cleanedBase64);
          try {
            decodedBody = new TextDecoder("utf-8").decode(Uint8Array.from(decoded, c => c.charCodeAt(0)));
          } catch (e) {
            decodedBody = decoded;
          }
        } catch (e) {}
      }

      if (rawEmail.toLowerCase().includes("content-type: text/html")) {
        htmlParts.push(decodedBody);
      } else {
        textParts.push(decodedBody);
      }
    }
  }

  // Concatenate parts so they can be isolated by the Android app's isolateParts function
  if (textParts.length > 0 || htmlParts.length > 0) {
    const plainCombined = textParts.join("\n\n").trim();
    const htmlCombined = htmlParts.join("\n\n").trim();
    
    if (plainCombined && htmlCombined) {
      text = plainCombined + "\n\n" + htmlCombined;
    } else if (htmlCombined) {
      text = htmlCombined;
    } else {
      text = plainCombined;
    }
  }

  // Absolute fallback to prevent zero text stored
  if (!text.trim()) {
    const doubleNewlineIndex = rawEmail.search(/\r?\n\r?\n/);
    if (doubleNewlineIndex !== -1) {
      text = rawEmail.substring(doubleNewlineIndex).trim();
    } else {
      text = rawEmail;
    }
    if (text.length > 10000) {
      text = text.substring(0, 10000) + "... (Truncated)";
    }
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
