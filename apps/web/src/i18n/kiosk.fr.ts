import type { KioskMessages } from "./kiosk.en.js";

/** Les quelques libellés de la borne, en français. */
export const kioskFr: KioskMessages = {
  aria: {
    scene: "Thin Air en mode borne — le fantôme joue ; levez une main pour prendre la main.",
  },
  degraded: {
    cameraLost:
      "La caméra a été débranchée ou perdue. Le fantôme continue de jouer, et réécoutera les mains à son retour.",
    cameraDenied:
      "L'accès à la caméra a été refusé. Le fantôme continue de jouer à l'écran.",
    modelError:
      "Le modèle de mains n'a pas pu être chargé. Le fantôme continue de jouer.",
  },
  privacy: "Rien ne quitte ce navigateur : aucune image, aucune prise, aucune note n'est envoyée.",
};