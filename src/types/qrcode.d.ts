declare module "qrcode" {
  type Options = {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  };
  const QRCode: {
    toDataURL(text: string, options?: Options): Promise<string>;
  };
  export default QRCode;
}
