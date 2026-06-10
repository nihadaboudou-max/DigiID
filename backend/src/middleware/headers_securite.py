# -*- coding: utf-8 -*-
"""
Middleware d'ajout des headers de sécurité sur toutes les réponses.

Headers ajoutés :
  - Strict-Transport-Security : force HTTPS pendant 1 an (HSTS)
  - X-Content-Type-Options : empêche le MIME sniffing
  - X-Frame-Options : empêche l'inclusion dans une iframe (clickjacking)
  - Referrer-Policy : limite les fuites d'URL
  - Content-Security-Policy : restreint les sources autorisées
  - Permissions-Policy : désactive les APIs sensibles inutilisées
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


class MiddlewareHeadersSecurite(BaseHTTPMiddleware):
    """Ajoute les headers de sécurité standard à chaque réponse."""

    async def dispatch(self, requete: Request, prochain_appel):
        reponse = await prochain_appel(requete)

        # Forcer HTTPS pendant 1 an + sous-domaines
        reponse.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Empêcher les navigateurs de deviner le type MIME
        reponse.headers["X-Content-Type-Options"] = "nosniff"

        # Empêcher l'inclusion dans une iframe (anti-clickjacking)
        reponse.headers["X-Frame-Options"] = "DENY"

        # Limiter ce que le Referer peut révéler
        reponse.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # CSP restrictive — à étendre quand on ajoutera le frontend
        reponse.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

        # Désactiver les APIs sensibles que DigiID n'utilise pas
        reponse.headers["Permissions-Policy"] = (
            "camera=(self), microphone=(), geolocation=(), payment=(), "
            "usb=(), magnetometer=(), gyroscope=()"
        )

        # Identifiant unique de la requête (utile pour le support)
        if "X-Request-ID" in requete.headers:
            reponse.headers["X-Request-ID"] = requete.headers["X-Request-ID"]

        return reponse
