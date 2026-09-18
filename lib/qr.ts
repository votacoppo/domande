import "server-only";
import QRCode from "qrcode";
import { questionFormUrl } from "./config";

export async function questionQrDataUrl(): Promise<string> {
  return QRCode.toDataURL(questionFormUrl(), {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 720,
    color: { dark: "#123A63", light: "#FFFFFF" },
  });
}
