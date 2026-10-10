import { Navigate, useSearchParams } from "react-router-dom";
import { PhotoDataWorkspace } from "../components/photo-data/PhotoDataWorkspace";

export default function PhotoDataPage() {
  const [params] = useSearchParams();
  if (params.get("view") === "files") {
    const next = new URLSearchParams(params);
    next.delete("view");
    next.set("photo_files", "1");
    return <Navigate to={"/data-tools?" + next.toString()} replace />;
  }
  return <PhotoDataWorkspace key={params.toString()} workspace="charts" />;
}
