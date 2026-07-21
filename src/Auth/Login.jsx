import { useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { Navigate, useNavigate } from "react-router";
import { auth, functions } from "../../Firebase";
import { useAdminAuth } from "./AdminAuthContext";
import logo from "/mlmboo2.ico?url";

const friendlyError = (error) => {
  const code = error?.code || "";
  if (error?.message?.includes("Incorrect OTP")) return "OTP सही नहीं है। दोबारा जाँचें।";
  if (code.includes("invalid-verification-code")) return "OTP सही नहीं है। दोबारा जाँचें।";
  if (code.includes("too-many-requests") || code.includes("resource-exhausted")) return "बहुत अधिक प्रयास हुए। कुछ समय बाद प्रयास करें।";
  if (code.includes("unauthenticated")) return "OTP session समाप्त हो गया। फिर से OTP लें।";
  if (code.includes("permission-denied")) return "यह नंबर Admin panel के लिए अधिकृत नहीं है।";
  return error?.message?.replace(/Firebase/gi, "Service") || "Login पूरा नहीं हुआ। फिर से प्रयास करें।";
};

export function Login() {
  const navigate = useNavigate();
  const { session } = useAdminAuth();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [loginTicket, setLoginTicket] = useState("");
  const [step, setStep] = useState("mobile");
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (session) return <Navigate to="/" replace />;
  const sendOtp = async (e) => {
    e.preventDefault(); setError("");
    if (!/^\d{10}$/.test(mobile)) return setError("10 अंकों का सही mobile number डालें।");
    setLoading(true);
    try {
      const result = await httpsCallable(functions, "panelStartTwoFactorOtp")({ panel: "admin", mobile });
      setChallengeId(result.data.challengeId);
      setStep("otp");
    } catch (e2) { setError(friendlyError(e2)); }
    finally { setLoading(false); }
  };
  const verifyOtp = async (e) => {
    e.preventDefault(); setError("");
    if (!/^\d{4}$/.test(otp)) return setError("4 अंकों का OTP डालें।");
    setLoading(true);
    try {
      const result = await httpsCallable(functions, "panelVerifyTwoFactorOtp")({ panel: "admin", challengeId, otp });
      setLoginTicket(result.data.loginTicket);
      setActors(result.data.actors || []); setStep("actor");
    } catch (e2) { setError(friendlyError(e2)); }
    finally { setLoading(false); }
  };
  const enter = async (actorId) => {
    setLoading(true); setError("");
    try {
      const result = await httpsCallable(functions, "panelCreateSessionFromTwoFactor")({ panel: "admin", challengeId, loginTicket, actorId });
      await signInWithCustomToken(auth, result.data.token);
      const selected = actors.find(a => a.id === actorId);
      if (selected?.actorType === "owner") {
        await httpsCallable(functions, "purgeLegacyPanelSecrets")({}).catch(() => null);
      }
      navigate("/", { replace: true });
    } catch (e2) { setError(friendlyError(e2)); }
    finally { setLoading(false); }
  };

  return <div className="min-h-screen grid place-items-center bg-slate-50 p-5">
    <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-7 space-y-6">
      <div className="text-center"><img src={logo} alt="MLM Live" className="w-20 h-20 mx-auto rounded-2xl"/><h1 className="text-xl font-bold mt-3">Admin Secure Login</h1><p className="text-sm text-gray-500 mt-1">Owner OTP से Admin या authorised sub-user खोलें</p></div>
      {step === "mobile" && <form onSubmit={sendOtp} className="space-y-4"><input autoComplete="tel" inputMode="numeric" value={mobile} onChange={e=>setMobile(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="Owner mobile number" className="w-full h-12 border rounded-xl px-4"/><button disabled={loading} className="w-full h-12 rounded-xl bg-violet-600 text-white font-semibold disabled:opacity-60">{loading?"Sending…":"Send OTP"}</button></form>}
      {step === "otp" && <form onSubmit={verifyOtp} className="space-y-4"><input autoComplete="one-time-code" inputMode="numeric" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="4-digit OTP" className="w-full h-12 border rounded-xl px-4 tracking-[.35em] text-center"/><button disabled={loading} className="w-full h-12 rounded-xl bg-violet-600 text-white font-semibold disabled:opacity-60">{loading?"Verifying…":"Verify OTP"}</button><button type="button" onClick={()=>{setStep("mobile");setOtp("");setChallengeId("");}} className="w-full text-sm text-gray-500">Change number</button></form>}
      {step === "actor" && <div className="space-y-3"><p className="text-sm font-semibold">किस account में प्रवेश करना है?</p>{actors.map(a=><button key={a.id} disabled={loading} onClick={()=>enter(a.id)} className="w-full text-left border rounded-xl p-3 hover:border-violet-500"><span className="block font-semibold">{a.name}</span><span className="text-xs text-gray-500">{a.actorType === "owner" ? "Master Admin" : a.role}</span></button>)}</div>}
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
    </div>
  </div>;
}
