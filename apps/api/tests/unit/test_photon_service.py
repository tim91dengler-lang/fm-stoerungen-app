"""Unit-Tests für photon_service — Photon-Antworten gemockt, kein Netzwerk-Call."""

import httpx
import pytest

from fm_api.services import photon_service

PHOTON_SAMPLE = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [8.6692, 50.1109]},
            "properties": {
                "osm_type": "W",
                "country": "Deutschland",
                "city": "Frankfurt am Main",
                "countrycode": "DE",
                "postcode": "60594",
                "type": "street",
                "name": "Schweizer Straße",
                "state": "Hessen",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [8.0, 49.0]},
            "properties": {
                "country": "Frankreich",
                "city": "Paris",
                "countrycode": "FR",
                "type": "street",
                "name": "Rue de Rivoli",
            },
        },
    ],
}


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    photon_service.clear_cache()


def _mock_transport(payload: dict) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    return httpx.MockTransport(handler)


@pytest.mark.unit
async def test_suggest_returns_normalized_results() -> None:
    transport = _mock_transport(PHOTON_SAMPLE)
    async with httpx.AsyncClient(transport=transport) as client:
        results = await photon_service.suggest("schweizer straße 88", country="de", client=client)
    # FR-Treffer wurde ausgefiltert (country-Filter)
    assert len(results) == 1
    r = results[0]
    assert r.strasse == "Schweizer Straße"
    assert r.plz == "60594"
    assert r.ort == "Frankfurt am Main"
    assert r.land == "DE"
    assert r.latitude == 50.1109
    assert r.longitude == 8.6692
    assert "Schweizer Straße" in r.label
    assert "60594" in r.label


@pytest.mark.unit
async def test_suggest_too_short_returns_empty() -> None:
    transport = _mock_transport(PHOTON_SAMPLE)
    async with httpx.AsyncClient(transport=transport) as client:
        results = await photon_service.suggest("ab", client=client)
    assert results == []


@pytest.mark.unit
async def test_suggest_uses_cache() -> None:
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        return httpx.Response(200, json=PHOTON_SAMPLE)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        await photon_service.suggest("frankfurt", client=client)
        await photon_service.suggest("frankfurt", client=client)
        await photon_service.suggest("FRANKFURT", client=client)  # gleicher Key (lowercased)
    assert call_count["n"] == 1


@pytest.mark.unit
async def test_suggest_handles_photon_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="upstream down")

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        results = await photon_service.suggest("hauptstraße", client=client)
    assert results == []
