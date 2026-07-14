variable "auraone_zone_id" {
  description = "Cloudflare zone ID for auraone.ai."
  type        = string
}

resource "cloudflare_record" "rubric_studio_open" {
  zone_id = var.auraone_zone_id
  name    = "rubric-studio"
  type    = "CNAME"
  value   = "cname.vercel-dns.com"
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "docs_rubric_studio_open" {
  zone_id = var.auraone_zone_id
  name    = "docs.rubricstudio"
  type    = "CNAME"
  value   = "cname.vercel-dns.com"
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "install_auraone_open" {
  zone_id = var.auraone_zone_id
  name    = "install"
  type    = "CNAME"
  value   = "auraone-open-install.workers.dev"
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "updates_auraone_open" {
  zone_id = var.auraone_zone_id
  name    = "updates"
  type    = "CNAME"
  value   = "auraone-open-updates.workers.dev"
  proxied = true
  ttl     = 1
}
