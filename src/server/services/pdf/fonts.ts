import { Font } from "@react-pdf/renderer";
import path from "node:path";

const fontDirectory = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "NotoSans",
  src: path.join(fontDirectory, "NotoSans-Regular.ttf"),
});

Font.register({
  family: "NotoSans-Bold",
  src: path.join(fontDirectory, "NotoSans-Bold.ttf"),
});
