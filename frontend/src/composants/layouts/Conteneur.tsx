/**
 * Conteneur de page avec padding et largeur maximale.
 * Assure un espacement correct sur tous les écrans.
 */
export function Conteneur({ 
  children, 
  taille = "large" 
}: { 
  children: React.ReactNode;
  taille?: "petit" | "moyen" | "large" | "plein";
}) {
  const largeurs = {
    petit: "max-w-4xl",
    moyen: "max-w-6xl",
    large: "max-w-7xl",
    plein: "max-w-full",
  };

  return (
    <div className={`${largeurs[taille]} mx-auto px-4 sm:px-6 lg:px-8 py-6`}>
      {children}
    </div>
  );
}