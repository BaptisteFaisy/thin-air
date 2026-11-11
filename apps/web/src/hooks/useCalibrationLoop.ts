/** Le relevé de calibration : un échantillon par seconde (cahier §7.4). */
import { useEffect } from "react";
import { isCalibrating, sampleCalibration, tickCalibration, type CalibrationState } from "../state/calibration.js";
import { positionCourante, type Miroir } from "../scene/modele.js";

export function useCalibrationLoop(
  calibration: CalibrationState,
  setCalibration: (fn: (avant: CalibrationState) => CalibrationState) => void,
  miroir: { current: Miroir },
): void {
  useEffect(() => {
    if (!isCalibrating(calibration)) return () => undefined;
    const id = window.setInterval(() => {
      setCalibration((avant) => {
        const echantillon = positionCourante(miroir.current);
        const releve = echantillon === null ? avant : sampleCalibration(avant, echantillon);
        return tickCalibration(releve);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [calibration, miroir, setCalibration]);
}
