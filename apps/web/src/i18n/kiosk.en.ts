/** Les quelques libellés de la borne, en anglais (AIR-N-14). */
export interface KioskMessages {
  readonly aria: { readonly scene: string };
  readonly degraded: {
    readonly cameraLost: string;
    readonly cameraDenied: string;
    readonly modelError: string;
  };
  readonly privacy: string;
}

export const kioskEn: KioskMessages = {
  aria: {
    scene: "Thin Air kiosk — the ghost plays; raise a hand to take over.",
  },
  degraded: {
    cameraLost:
      "The camera was unplugged or lost. The ghost keeps playing, and will listen for hands again when it returns.",
    cameraDenied:
      "Camera access was refused. The ghost keeps playing on screen.",
    modelError:
      "The hand model could not be loaded. The ghost keeps playing.",
  },
  privacy: "Nothing leaves this browser: no picture, no take, no note is sent anywhere.",
};