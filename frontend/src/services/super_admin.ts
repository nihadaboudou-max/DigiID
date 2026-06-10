/**
 * Service super admin — gestion des administrateurs.
 *
 * Ce fichier réexporte depuis super_admin_v2.ts pour éviter la duplication.
 * Toute nouvelle fonctionnalité doit être ajoutée dans super_admin_v2.ts.
 */
export {
  listerAdmins,
  creerAdmin,
  suspendreAdmin,
  reactiverAdmin,
} from "./super_admin_v2";

export type {
  AdminApercu,
  ListeAdmins,
  CreerAdminRequete,
} from "./super_admin_v2";
