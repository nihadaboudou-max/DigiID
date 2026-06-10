"use client";

/**
 * Système de notifications toast — affichage éphémère en bas à droite.
 * Usage : `const { notifier } = useNotifications(); notifier("Succès !", "succes");`
 */
import {
  createContext, useCallback, useContext, useState,
  type ReactNode,
} from "react";

type VarianteNotification = "info" | "succes" | "avertissement" | "erreur";

interface Notification {
  id: string;
  message: string;
  variante: VarianteNotification;
}

interface ContexteNotifications {
  notifier: (message: string, variante?: VarianteNotification) => void;
}

const Contexte = createContext<ContexteNotifications | undefined>(undefined);

const DUREE_AFFICHAGE_MS = 4000;

const STYLES: Record<VarianteNotification, string> = {
  info:          "bg-lagune text-white",
  succes:        "bg-green-600 text-white",
  avertissement: "bg-ocre text-ardoise",
  erreur:        "bg-terre text-white",
};

const ICONES: Record<VarianteNotification, string> = {
  info: "i", succes: "✓", avertissement: "!", erreur: "×",
};

export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);

  const notifier = useCallback(
    (message: string, variante: VarianteNotification = "info") => {
      const id = `n-${Date.now()}-${Math.random()}`;
      setItems((liste) => [...liste, { id, message, variante }]);
      setTimeout(() => {
        setItems((liste) => liste.filter((n) => n.id !== id));
      }, DUREE_AFFICHAGE_MS);
    },
    [],
  );

  function retirer(id: string) {
    setItems((liste) => liste.filter((n) => n.id !== id));
  }

  return (
    <Contexte.Provider value={{ notifier }}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm"
        aria-live="polite"
      >
        {items.map((n) => (
          <div
            key={n.id}
            className={`${STYLES[n.variante]} rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 apparition`}
          >
            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold flex-shrink-0">
              {ICONES[n.variante]}
            </span>
            <p className="text-sm flex-grow">{n.message}</p>
            <button
              type="button"
              onClick={() => retirer(n.id)}
              aria-label="Fermer"
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </Contexte.Provider>
  );
}

export function useNotifications(): ContexteNotifications {
  const ctx = useContext(Contexte);
  if (!ctx) {
    throw new Error("useNotifications() doit être utilisé à l'intérieur de FournisseurNotifications");
  }
  return ctx;
}
