import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Áreas privadas ou sem valor de indexação.
      disallow: ["/admin", "/perfil", "/criar-evento", "/api/", "/auth/"],
    },
    sitemap: "https://achafestas.com/sitemap.xml",
    host: "https://achafestas.com",
  };
}
