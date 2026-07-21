import { createContext, useContext,useState,useEffect } from "react";
const DataContextGen = createContext();

function GeneralContext({ children }) {

 const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );
  useEffect(() => {
    const html = document.documentElement;
    html.className = theme;
    html.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const datademo = "234";

  const API_KEY = "ADS360KEY";
  const HOST = "cvmhznb2u7";

  const SIGNIN_URL = `https://${String(HOST)}.execute-api.ap-south-1.amazonaws.com/signinUser/?API_KEY=${API_KEY}`;
  const SIGNUP_URL = `https://${String(HOST)}.execute-api.ap-south-1.amazonaws.com/createUser/?API_KEY=${API_KEY}`;
  const VERIFY_OTP_URL = `https://${HOST}.execute-api.ap-south-1.amazonaws.com/verifyOtp/?API_KEY=${API_KEY}`;
  const FORGET_PASS_URL =  `https://${HOST}.execute-api.ap-south-1.amazonaws.com/forgetPass/?API_KEY=${API_KEY}`;

  const CreateProfileApi = `https://${HOST}.execute-api.ap-south-1.amazonaws.com/CreateMlmUser/?API_KEY=${API_KEY}`;
  const UpdateProfileApi = `https://${HOST}.execute-api.ap-south-1.amazonaws.com/mlmUser`;
  const GetMlMTempByID = `https://${HOST}.execute-api.ap-south-1.amazonaws.com/tempByCompany`;

  return (
    <>
      <DataContextGen.Provider value={{ theme, toggleTheme }}>
        {children}
      </DataContextGen.Provider>
    </>
  );
}

const useGeneralData = () => {
  return useContext(DataContextGen);
};

export { GeneralContext, useGeneralData };
