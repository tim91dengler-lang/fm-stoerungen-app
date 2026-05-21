"""Photon-Geocoding-Proxy mit LRU-Cache (ADR 0005).

Backend ruft Photon (Komoot) auf, normalisiert die Antwort auf
``AdresseSuggestion`` und cached gleiche Queries 24h lang.
"""

import logging
import time
from collections import OrderedDict
from typing import Any

import httpx

from fm_api.schemas.adresse import AdresseSuggestion

logger = logging.getLogger(__name__)

PHOTON_URL = "https://photon.komoot.io/api/"
PHOTON_TIMEOUT_SECONDS = 5.0
CACHE_MAX_ENTRIES = 1000
CACHE_TTL_SECONDS = 60 * 60 * 24  # 24h


_CacheValue = tuple[float, list[AdresseSuggestion]]
_cache: OrderedDict[str, _CacheValue] = OrderedDict()


class GeocodingUnavailableError(Exception):
    """Photon ist nicht erreichbar oder hat einen Fehler geliefert."""


def _cache_key(query: str, country: str | None, limit: int) -> str:
    return f"{query.strip().lower()}|{(country or '').lower()}|{limit}"


def _get_cached(key: str) -> list[AdresseSuggestion] | None:
    if key not in _cache:
        return None
    stored_at, value = _cache[key]
    if time.time() - stored_at > CACHE_TTL_SECONDS:
        del _cache[key]
        return None
    # Move-to-end für LRU-Semantik
    _cache.move_to_end(key)
    return value


def _set_cached(key: str, value: list[AdresseSuggestion]) -> None:
    if key in _cache:
        _cache.move_to_end(key)
    _cache[key] = (time.time(), value)
    if len(_cache) > CACHE_MAX_ENTRIES:
        _cache.popitem(last=False)


def clear_cache() -> None:
    """Nur für Tests gedacht."""
    _cache.clear()


def _feature_to_suggestion(feature: dict[str, Any]) -> AdresseSuggestion | None:
    props = feature.get("properties") or {}
    geom = feature.get("geometry") or {}
    coords = geom.get("coordinates") or [None, None]

    osm_type = (props.get("type") or "").lower()
    # Filter: nur sinnvolle Adress-Treffer (street, house, locality)
    if osm_type not in ("house", "street", "locality") and osm_type:
        # Auch leeren type akzeptieren, da Photon manchmal "type" weglässt
        return None

    strasse = props.get("street") or props.get("name")
    hausnummer = props.get("housenumber")
    plz = props.get("postcode")
    ort = props.get("city") or props.get("town") or props.get("village")
    countrycode = (props.get("countrycode") or "").upper() or None
    longitude, latitude = (
        (coords[0] if len(coords) > 0 else None),
        (coords[1] if len(coords) > 1 else None),
    )

    if not (strasse or ort):
        return None

    parts: list[str] = []
    if strasse:
        line = strasse
        if hausnummer:
            line = f"{strasse} {hausnummer}"
        parts.append(line)
    if plz or ort:
        parts.append(" ".join(p for p in (plz, ort) if p))
    if countrycode:
        parts.append(countrycode)
    label = ", ".join(parts)

    return AdresseSuggestion(
        strasse=strasse,
        hausnummer=hausnummer,
        plz=plz,
        ort=ort,
        land=countrycode,
        latitude=latitude,
        longitude=longitude,
        label=label,
    )


async def suggest(
    query: str,
    *,
    country: str | None = "de",
    limit: int = 5,
    client: httpx.AsyncClient | None = None,
) -> list[AdresseSuggestion]:
    """Schlage Adressen für eine User-Eingabe vor.

    Returns eine (möglicherweise leere) Liste; raised nur bei harten Fehlern.
    Bei Network-Errors / Photon-Down: leere Liste + Warning-Log, damit das
    Frontend die manuelle Eingabe nicht blockiert (ADR 0005 Failure-Modes).
    """
    cleaned = query.strip()
    if len(cleaned) < 3:
        return []

    cache_key = _cache_key(cleaned, country, limit)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    params: dict[str, str | int] = {"q": cleaned, "limit": limit, "lang": "de"}
    if country:
        params["lang"] = "de"

    owns_client = client is None
    client_to_use = client or httpx.AsyncClient(timeout=PHOTON_TIMEOUT_SECONDS)
    try:
        try:
            resp = await client_to_use.get(PHOTON_URL, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("photon geocoding failed for '%s': %s", cleaned, exc)
            return []

        body = resp.json()
    finally:
        if owns_client:
            await client_to_use.aclose()

    features = body.get("features") or []
    suggestions: list[AdresseSuggestion] = []
    for feature in features:
        s = _feature_to_suggestion(feature)
        if s is not None:
            suggestions.append(s)
        if len(suggestions) >= limit:
            break

    # Optional länderspezifischer Filter (Photon ignoriert das Query-Parameter
    # `osm_tag=...` ohne Werkkennung — also filtern wir client-seitig nach country).
    if country:
        country_upper = country.upper()
        suggestions = [s for s in suggestions if (s.land or country_upper) == country_upper]

    _set_cached(cache_key, suggestions)
    return suggestions
