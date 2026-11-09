# potok forme

Forma za unos koja radi kao Google Forms, a izgleda kao ostatak Potoka: Potok aplikacija koju donosi šablon **Forma** u meniju „Kreiraj podgrupu“. Napravljena je po šablonu [potok-vite](https://github.com/aberged/potok-vite/tree/align-alt-descriptions): Vite, TypeScript, Tailwind, daisyUI sa prefiksom `d-` i lit-html.

Definicija forme i odgovori su data vrednosti grupe, u kolekcijama sa pravilima (`PotokIde.Social.AppData` u potok-ide):

- konfiguracija (`getConfig`, `saveConfig`) drži formu, pravila koja Potok sprovodi (ko popunjava, ko vidi sve odgovore, jedan odgovor, izmena, rok, anonimnost, javna forma, fajlovi, kviz) i tajni deo sa tačnim odgovorima, koji čitaju samo urednici;
- odgovori su vrednosti kolekcije `responses`, a rezime broji Potok (`summarizeValues`);
- fajlovi idu u podgrupe „Fajlovi“ i „Privatni fajlovi“ (`ensureFileGroups`, `uploadFile`, `uploadImage`, `fileUrl`).

Vodič za ceo sklop je u potok-ide, [docs/forma.md](https://github.com/aberged/potok-ide/blob/dev/docs/forma.md).

## Brzi start

```sh
npm install
npm run dev      # lokalno, na portu 5177, uz dev mock potok API-ja
npm test
npm run build    # tsc + vite build → dist/potok-build.html
```

Posle builda, u `potok-ide`:

```sh
mix potok.sync_apps
```

Kopija ide u `priv/apps/forme.html`, a nova verzija stiže samo u forme napravljene posle nje.

U dev režimu:

- `?viewer=` igra drugog gledaoca: `editor` (podrazumevano, admin), `reader` (uloga „pregled“), `member` (uloga „ispitanik“), `outsider` (prijavljen nečlan), `guest`;
- `?lang=en` ili `?lang=sr-Cyrl` bira jezik;
- `?seed=empty` počinje bez forme. Primer forme ima sve tipove pitanja i 120 odgovora. Za novi početak: `localStorage.clear()`.

## Šta ume

- **Uređivač**: 12 tipova pitanja, opcije sa slikama i „Drugo“, mešanje, provera odgovora, sekcije i prelaz na sekciju po odgovoru, naslovi, slike i video, prevlačenje, opoziv i ponavljanje, automatsko čuvanje sa revizijom i konfliktom, slika zaglavlja i objava. **Popuni** pokazuje uredniku formu kakvu vide ispitanici: odgovor se šalje kao svaki drugi kad ga pravila puštaju, a inače je to pregled, uz razlog.
- **Popunjavanje**: sekcija po sekcija, traka napretka, obavezna pitanja i provere, nacrt na uređaju, fajlovi, potvrda, još jedan odgovor, izmena odgovora, rezultat kviza.
- **Odgovori**: rezime sa grafikonima, pregled po pitanju i ko je šta izabrao, pojedinačni odgovori sa ručnim ocenjivanjem, tabela sa stranicama, CSV, brisanje, prijem odgovora i poruka kad je zatvoren, obaveštenja za mene, objava ocena.

## Izgled

Forma nema svoje boje: uzima temu stranice Potoka (svetlu ili tamnu), čije CSS promenljive okvir dobija sa stranice. Kartice, dugmad u obliku pilule, prekidači i dijalozi prate `core_components.ex` iz potok-ide, a ikonice su Heroicons, iste kao na stranici: `src/views/icons.ts` piše `python scripts/icons.py` iz `deps/heroicons` u potok-ide, posle `mix deps.get` tamo. Grafikoni koriste primarnu boju u svetloj temi i za nijansu dublje plavo nebo u tamnoj, jer je primarna boja tamne teme prebleda za stubiće.

## Jezici

Stranica Potoka upisuje jezik u `<html lang>` okvira: `sr`, `sr-Cyrl` ili `en`. Reči su u `src/i18n.ts`. Srpski je referenca, a ćirilica se računa iz njega i važi samo za reči aplikacije.

## Struktura

| Fajl | Šta je |
|---|---|
| [src/model/form.ts](src/model/form.ts) | forma: tipovi, podrazumevano, čitanje sačuvanog bez poverenja |
| [src/model/config.ts](src/model/config.ts) | forma u konfiguraciji i nazad: pravila, ključ kviza |
| [src/model/answers.ts](src/model/answers.ts) | odgovori: provere, grananje, zapis, tekst za tabelu |
| [src/model/rich.ts](src/model/rich.ts) | **podebljano**, *kurziv*, __podvučeno__, linkovi i liste, kao tokeni, nikad HTML |
| [src/model/csv.ts](src/model/csv.ts) | CSV sa zaštitom od formula |
| [src/store/](src/store) | stanje, uređivanje, popunjavanje, odgovori, pokretanje |
| [src/views/](src/views) | lit-html prikaz; grafikoni u `views/charts.ts` |
| [src/model/model.test.ts](src/model/model.test.ts) | vitest testovi |
| [src/dev-tools.ts](src/dev-tools.ts), [src/dev-theme.css](src/dev-theme.css) | samo za dev |
| [scripts/icons.py](scripts/icons.py) | piše `src/views/icons.ts` iz Heroicons-a u potok-ide |
| [src/potok.ts](src/potok.ts), [src/potok-dev.ts](src/potok-dev.ts), [vite.config.ts](vite.config.ts) | iz šablona, bez izmena |

## Licenca

MIT, vidi [LICENSE](LICENSE). Ikonice u `src/views/icons.ts` su iz [Heroicons](https://github.com/tailwindlabs/heroicons), takođe pod MIT licencom (Tailwind Labs), čija je napomena u istom fajlu i u LICENSE.
