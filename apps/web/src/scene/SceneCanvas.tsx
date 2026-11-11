/**
 * Le canevas de la scène (cahier §11.8) : redessiné à chaque image d'écran,
 * sans jamais afficher l'image de la caméra par défaut (AIR-F-52). Les
 * réglages vivent hors du canevas, dans la page, pour le clavier et les
 * lecteurs d'écran.
 */
import { useEffect, useRef, type JSX, type RefObject } from "react";
import { PALETTE, paintScene, type PaintContext } from "./paint.js";
import type { SceneModel } from "./geometry.js";

export interface FrameRequest {
  readonly dtS: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneCanvasProps {
  readonly label: string;
  readonly model: (frame: FrameRequest) => SceneModel;
  readonly videoRef?: RefObject<HTMLVideoElement | null>;
  readonly showCamera: boolean;
}

/** Atténuation de l'image de caméra, quand le réglage la montre (§12.3). */
export const CAMERA_DIM = 0.16;

function cameraLayer(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  width: number,
  height: number,
): () => void {
  return () => {
    if (video === null || video.readyState < 2 || video.videoWidth === 0) return;
    ctx.save();
    ctx.globalAlpha = CAMERA_DIM;
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();
  };
}

export function SceneCanvas({ label, model, videoRef, showCamera }: SceneCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    let actif = true;
    let precedent = 0;

    const image = (maintenant: number) => {
      if (!actif) return;
      const dtS = precedent === 0 ? 0 : Math.min(0.1, (maintenant - precedent) / 1000);
      precedent = maintenant;
      const largeur = canvas.clientWidth || 640;
      const hauteur = canvas.clientHeight || 360;
      const ratio = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
      if (canvas.width !== Math.round(largeur * ratio) || canvas.height !== Math.round(hauteur * ratio)) {
        canvas.width = Math.round(largeur * ratio);
        canvas.height = Math.round(hauteur * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const modele = modelRef.current({ dtS, width: largeur, height: hauteur });
      paintScene(
        ctx as PaintContext,
        modele,
        PALETTE,
        showCamera ? cameraLayer(ctx, videoRef?.current ?? null, largeur, hauteur) : undefined,
      );
      requestAnimationFrame(image);
    };
    requestAnimationFrame(image);
    return () => {
      actif = false;
    };
  }, [showCamera, videoRef]);

  return <canvas ref={canvasRef} className="scene" role="img" aria-label={label} />;
}
