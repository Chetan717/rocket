import { useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { Navigate, useNavigate } from "react-router";
import { auth, functions } from "../../Firebase";
import { useAdminAuth } from "./AdminAuthContext";
import { getDeviceInfo } from "../Utils/securityDevice";

const MASKED_ADMIN_EMAIL = "ml***@gmail.com";
const inputClass = "w-full h-12 border rounded-xl px-4";
const strongPassword = (password) => (
  password.length >= 8 &&
  password.length <= 12 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password)
);
const friendlyMessage = (error) => {
  const message = error?.message || "Login पूरा नहीं हुआ।";
  if (message.includes("Email OTP could not be sent")) {
    return "Email OTP अभी भेजा नहीं जा सका। कुछ देर बाद फिर कोशिश करें।";
  }
  if (message.includes("Incorrect OTP")) return "OTP सही नहीं है। दोबारा जाँचें।";
  if (message.includes("Exactly one active Master Admin")) {
    return "Active Master Admin configuration सही नहीं है।";
  }
  return message.replace(/Firebase/gi, "Service");
};

export function SecureLogin() {
  const navigate = useNavigate();
  const {
    loading: checking,
    session,
    unlocked,
    unlock,
    markUnlocked,
  } = useAdminAuth();
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [ticket, setTicket] = useState("");
  const [maskedEmail, setMaskedEmail] = useState(MASKED_ADMIN_EMAIL);
  const [actors, setActors] = useState([]);
  const [actor, setActor] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (checking) return <LoginBox>Checking session…</LoginBox>;
  if (session && unlocked) return <Navigate to="/" replace />;

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(friendlyMessage(caught));
    } finally {
      setBusy(false);
    }
  };
  const validatePassword = () => {
    if (!strongPassword(password)) {
      throw new Error("8–12 characters: uppercase, lowercase, number और special character जरूरी है।");
    }
  };

  const unlockNow = (event) => {
    event.preventDefault();
    run(async () => {
      validatePassword();
      await unlock(password);
      navigate("/", { replace: true });
    });
  };

  if (session) {
    return <LoginBox title="Session Locked" sub="Refresh के बाद password डालें; OTP नहीं।">
      <form onSubmit={unlockNow} className="space-y-3">
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          maxLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Strong password"
        />
        <SubmitButton busy={busy}>Unlock Panel</SubmitButton>
      </form>
      <ErrorMessage>{error}</ErrorMessage>
    </LoginBox>;
  }

  const sendOtp = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await httpsCallable(functions, "panelStartTwoFactorOtp")({});
      setChallengeId(result.data.challengeId);
      setMaskedEmail(result.data.maskedEmail || MASKED_ADMIN_EMAIL);
      setOtp("");
      setStep("otp");
    });
  };
  const verifyOtp = (event) => {
    event.preventDefault();
    run(async () => {
      if (!/^\d{6}$/.test(otp)) throw new Error("6 अंकों का OTP डालें।");
      const result = await httpsCallable(functions, "panelVerifyTwoFactorOtp")({
        challengeId,
        otp,
      });
      setTicket(result.data.loginTicket);
      setActors(result.data.actors || []);
      setStep("actor");
    });
  };
  const enter = (event) => {
    event.preventDefault();
    run(async () => {
      validatePassword();
      if (!actor) throw new Error("Admin account चुनें।");
      if (!actor.passwordConfigured && password !== confirmPassword) {
        throw new Error("दोनों passwords समान होने चाहिए।");
      }
      const result = await httpsCallable(functions, "panelCreateSessionFromTwoFactor")({
        challengeId,
        loginTicket: ticket,
        actorId: actor.id,
        password,
        device: getDeviceInfo(),
      });
      await signInWithCustomToken(auth, result.data.token);
      markUnlocked();
      if (result.data.loginAlert) {
        const previous = result.data.loginAlert;
        alert(`Last login: ${new Date(previous.createdAt).toLocaleString()}\n${previous.device?.label || "Unknown device"}\nIP: ${previous.ip || "Unavailable"}\n${previous.location || "Location unavailable"}`);
      }
      navigate("/", { replace: true });
    });
  };

  return <LoginBox title="Admin Secure Login" sub="Email OTP → account → strong password">
    {step === "email" && <form onSubmit={sendOtp} className="space-y-4">
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-center">
        <p className="text-sm text-gray-600">Admin OTP केवल इस email पर भेजा जाएगा</p>
        <p className="mt-1 font-semibold text-violet-700">{MASKED_ADMIN_EMAIL}</p>
      </div>
      <SubmitButton busy={busy}>Send Email OTP</SubmitButton>
    </form>}
    {step === "otp" && <form onSubmit={verifyOtp} className="space-y-4">
      <p className="text-center text-sm text-gray-500">6-digit OTP {maskedEmail} पर भेजा गया है।</p>
      <input
        className={`${inputClass} tracking-[.35em] text-center`}
        inputMode="numeric"
        autoComplete="one-time-code"
        value={otp}
        onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="6-digit OTP"
      />
      <SubmitButton busy={busy}>Verify Email OTP</SubmitButton>
      <button
        type="button"
        onClick={() => {
          setStep("email");
          setOtp("");
          setChallengeId("");
        }}
        className="w-full text-sm text-gray-500"
      >Send OTP again</button>
    </form>}
    {step === "actor" && <div className="space-y-2">
      {actors.map((account) => <button
        key={account.id}
        type="button"
        onClick={() => {
          setActor(account);
          setPassword("");
          setConfirmPassword("");
          setStep("password");
        }}
        className="w-full border rounded-xl p-3 text-left"
      >
        <b>{account.name}</b>
        <small className="block text-gray-500">{account.actorType === "owner" ? "Master Admin" : account.role}</small>
      </button>)}
    </div>}
    {step === "password" && <form onSubmit={enter} className="space-y-3">
      <p className="font-semibold">{actor?.passwordConfigured ? "Password डालें" : "Strong password बनाएं"}</p>
      <input
        className={inputClass}
        type="password"
        maxLength={12}
        autoComplete={actor?.passwordConfigured ? "current-password" : "new-password"}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="8–12 strong password"
      />
      {!actor?.passwordConfigured && <input
        className={inputClass}
        type="password"
        maxLength={12}
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Confirm password"
      />}
      <SubmitButton busy={busy}>{actor?.passwordConfigured ? "Login" : "Set Password & Login"}</SubmitButton>
    </form>}
    <ErrorMessage>{error}</ErrorMessage>
  </LoginBox>;
}

function LoginBox({ children, title, sub }) {
  return <div className="min-h-screen grid place-items-center bg-slate-50 p-5">
    <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-7 space-y-5">
      {title && <div className="text-center">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-gray-500">{sub}</p>
      </div>}
      {children}
    </div>
  </div>;
}

function SubmitButton({ children, busy }) {
  return <button
    disabled={busy}
    className="w-full h-12 rounded-xl bg-violet-600 text-white font-semibold disabled:opacity-60"
  >{busy ? "Please wait…" : children}</button>;
}

function ErrorMessage({ children }) {
  return children ? <p className="text-sm text-red-600 text-center">{children}</p> : null;
}
