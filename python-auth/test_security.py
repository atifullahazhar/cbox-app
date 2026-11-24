import hashlib
import hmac
import re
import unittest

E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")
DIGITS_ONLY_RE = re.compile(r"\D+")


def normalize_phone_e164(raw_phone: str, default_country_code: str = "+91") -> str:
    cleaned = raw_phone.strip()
    if cleaned.startswith("+"):
        digits = "+" + DIGITS_ONLY_RE.sub("", cleaned[1:])
    else:
        digits_only = DIGITS_ONLY_RE.sub("", cleaned)
        if len(digits_only) == 11 and digits_only.startswith("0"):
            digits_only = digits_only[1:]
        if len(digits_only) == 10:
            digits = f"{default_country_code}{digits_only}"
        else:
            digits = f"+{digits_only}"
    if not E164_RE.match(digits):
        raise ValueError("Invalid mobile number")
    return digits


def hash_otp(secret: str, phone: str, purpose: str, code: str) -> str:
    return hmac.new(secret.encode(), f"{phone}:{purpose}:{code}".encode(), hashlib.sha256).hexdigest()


class TestPythonAuthSecurity(unittest.TestCase):
    def test_phone_normalization_one_phone_one_account(self):
        self.assertEqual(normalize_phone_e164("9876543210"), "+919876543210")
        self.assertEqual(normalize_phone_e164("09876543210"), "+919876543210")
        self.assertEqual(normalize_phone_e164("+91 98765-43210"), "+919876543210")
        self.assertEqual(normalize_phone_e164("+1 (415) 555-2671"), "+14155552671")
        with self.assertRaises(ValueError):
            normalize_phone_e164("12345")

    def test_otp_hmac_verification_is_purpose_bound(self):
        h = hash_otp("test-secret", "+919876543210", "SIGNUP", "482910")
        self.assertTrue(hmac.compare_digest(h, hash_otp("test-secret", "+919876543210", "SIGNUP", "482910")))
        self.assertFalse(hmac.compare_digest(h, hash_otp("test-secret", "+919876543210", "LOGIN", "482910")))
        self.assertFalse(hmac.compare_digest(h, hash_otp("test-secret", "+919876543210", "SIGNUP", "482911")))


if __name__ == "__main__":
    unittest.main()
