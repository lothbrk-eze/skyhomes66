import React, { createContext, useContext, useEffect, useState } from "react";
import { configureRevenueCat } from "./../lib/revenuecat";

type RevenueCatContextType = {
  ready: boolean;
};

const RevenueCatContext = createContext<RevenueCatContextType>({ ready: false });

export const RevenueCatProvider = ({
  children,
  appUserID,
}: {
  children: React.ReactNode;
  appUserID?: string;
}) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await configureRevenueCat(appUserID);

        if (mounted) {
          setReady(true);
        }
      } catch (error) {
        console.log("RevenueCat init error:", error);
        if (mounted) {
          setReady(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [appUserID]);

  return (
    <RevenueCatContext.Provider value={{ ready }}>
      {children}
    </RevenueCatContext.Provider>
  );
};

export const useRevenueCat = () => useContext(RevenueCatContext);