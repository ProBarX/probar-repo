import { redirect } from "next/dist/client/components/navigation";
import Image from "next/image";

export default function Home() {
  redirect('/register');
}
