"use client";

/**
 * Page de gestion des notes internes police.
 * CRUD complet : création, consultation, modification, suppression.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Modal } from "@/composants/commun/Modal";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import {
  listerNotes, creerNote, modifierNote, supprimerNote,
} from "@/services/police";
import type { NoteInterne } from "@/services/police";

export default function PageNotes() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const searchParams = useSearchParams();
  const preselectedDigiid = searchParams.get("digiid") || "";

  const [notes, setNotes] = useState<NoteInterne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [noteEdition, setNoteEdition] = useState<NoteInterne | null>(null);

  // Formulaire
  const [personneDigiid, setPersonneDigiid] = useState(preselectedDigiid);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [categorie, setCategorie] = useState("info");
  const [estImportant, setEstImportant] = useState(false);
  const [estPartagee, setEstPartagee] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);

  useEffect(() => {
    charger();
  }, []);

  useEffect(() => {
    if (preselectedDigiid) setPersonneDigiid(preselectedDigiid);
  }, [preselectedDigiid]);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const data = await listerNotes();
      setNotes(data || []);
    } catch {
      setErreur("Impossible de charger les notes.");
    } finally {
      setChargement(false);
    }
  }

  function ouvrirCreation() {
    setNoteEdition(null);
    setPersonneDigiid(preselectedDigiid);
    setTitre("");
    setContenu("");
    setCategorie("info");
    setEstImportant(false);
    setEstPartagee(false);
    setAfficherFormulaire(true);
  }

  function ouvrirEdition(note: NoteInterne) {
    setNoteEdition(note);
    setPersonneDigiid(note.personne_digiid);
    setTitre(note.titre);
    setContenu(note.contenu || "");
    setCategorie(note.categorie);
    setEstImportant(note.est_important);
    setEstPartagee(note.est_partagee);
    setAfficherFormulaire(true);
  }

  async function handleSauvegarder() {
    if (!titre.trim() || !personneDigiid.trim()) return;

    setSauvegarde(true);
    try {
      if (noteEdition) {
        await modifierNote(noteEdition.id, {
          titre: titre.trim(),
          contenu: contenu.trim() || undefined,
          categorie,
          est_important: estImportant,
          est_partagee: estPartagee,
        });
      } else {
        await creerNote({
          personne_digiid: personneDigiid.trim().toUpperCase(),
          titre: titre.trim(),
          contenu: contenu.trim() || undefined,
          categorie,
          est_important: estImportant,
          est_partagee: estPartagee,
        });
      }
      setAfficherFormulaire(false);
      charger();
    } catch {
      setErreur("Erreur lors de la sauvegarde.");
    } finally {
      setSauvegarde(false);
    }
  }

  async function handleSupprimer(noteId: string) {
    if (!confirm("Supprimer cette note ?")) return;
    try {
      await supprimerNote(noteId);
      charger();
    } catch {
      setErreur("Impossible de supprimer la note.");
    }
  }

  const categories: { id: string; label: string }[] = [
    { id: "info", label: "Information" },
    { id: "alerte", label: "Alerte" },
    { id: "observation", label: "Observation" },
    { id: "audit", label: "Audit" },
  ];

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Notes internes</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
          <h1 className="mt-1">Notes internes</h1>
          <p className="text-ardoise-clair mt-1">Notes personnelles et partagées entre officiers.</p>
        </div>
        <Bouton variante="primaire" onClick={ouvrirCreation}>
          + Nouvelle note
        </Bouton>
      </div>

      {erreur && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">{erreur}</p>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{notes.length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Total notes</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">{notes.filter(n => n.est_important).length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Importantes</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">{notes.filter(n => n.est_partagee).length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Partagées</p>
        </div>
      </div>

      {/* Formulaire modal */}
      {(afficherFormulaire || noteEdition) && (
        <Modal
          titre={noteEdition ? "Modifier la note" : "Nouvelle note"}
          surFermeture={() => setAfficherFormulaire(false)}
        >
          <div className="space-y-4">
            <ChampSaisie
              libelle="DigiID de la personne"
              value={personneDigiid}
              onChange={(e) => setPersonneDigiid(e.target.value.toUpperCase())}
              placeholder="AB12CD34EF56GH78"
              maxLength={16}
            />
            <ChampSaisie
              libelle="Titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre de la note"
              required
            />
            <div>
              <label className="block text-sm font-medium text-ardoise mb-1">Contenu</label>
              <textarea
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                placeholder="Détails de la note..."
                rows={4}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ardoise mb-1">Catégorie</label>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategorie(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      categorie === cat.id
                        ? "bg-lagune text-white"
                        : "bg-sable text-ardoise-clair hover:bg-sable/80"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={estImportant}
                  onChange={(e) => setEstImportant(e.target.checked)}
                  className="rounded border-ardoise-clair/30"
                />
                <span className="text-ardoise">⭐ Important</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={estPartagee}
                  onChange={(e) => setEstPartagee(e.target.checked)}
                  className="rounded border-ardoise-clair/30"
                />
                <span className="text-ardoise">👥 Partagée</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <Bouton variante="primaire" chargement={sauvegarde} onClick={handleSauvegarder}>
                {noteEdition ? "Enregistrer" : "Créer la note"}
              </Bouton>
              <Bouton variante="ghost" onClick={() => setAfficherFormulaire(false)}>Annuler</Bouton>
            </div>
          </div>
        </Modal>
      )}

      {/* Liste des notes */}
      <Carte titre={`${notes.length} note(s)`}>
        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
        ) : notes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-ardoise-clair italic mb-4">Aucune note interne.</p>
            <Bouton variante="primaire" taille="petit" onClick={ouvrirCreation}>
              + Créer une note
            </Bouton>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`p-4 rounded-lg border-l-4 transition-all ${
                  note.est_important ? "border-l-terre bg-terre/5" : "border-l-lagune bg-sable"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-ardoise">{note.titre}</p>
                      {note.est_important && <span className="text-terre text-xs">⭐</span>}
                      {note.est_partagee && <span className="text-lagune text-xs">👥</span>}
                      <Badge variante="lagune" taille="petit">{note.categorie}</Badge>
                    </div>
                    {note.contenu && (
                      <p className="text-sm text-ardoise-clair mb-2">{note.contenu}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-ardoise-clair/60">
                      <span>👤 {note.personne_digiid}</span>
                      <span>🕐 {new Date(note.date_creation).toLocaleDateString("fr-FR")}</span>
                      {note.date_modification && note.date_modification !== note.date_creation && (
                        <span>📝 Modifié</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => ouvrirEdition(note)}
                      className="text-xs text-lagune hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleSupprimer(note.id)}
                      className="text-xs text-terre hover:underline"
                    >
                      Suppr.
                    </button>
                    <Link
                      href={`/police/profil/${note.personne_digiid}`}
                      className="text-xs text-ocre hover:underline"
                    >
                      Profil →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      <Link href="/police/dashboard">
        <Bouton variante="ghost">← Retour au dashboard</Bouton>
      </Link>
    </div>
  );
}
