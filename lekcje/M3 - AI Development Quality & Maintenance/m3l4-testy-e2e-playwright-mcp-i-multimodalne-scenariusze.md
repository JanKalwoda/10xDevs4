---
title: "Testy E2E: Playwright, MCP i multimodalne scenariusze"
course: "10xdevs-4"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-10-14"
format: "markdown"
---

![Obraz 1](https://images.przeprogramowani.pl/lessons/m3-l4/assets/cover.jpg)

Hooki z poprzedniej lekcji odpaliły linter, typecheck przeszedł, powiązane testy są zielone. Pełna automatyzacja: od edycji po commit.

Tyle że gdy użytkownik wygeneruje fiszki, zaakceptuje je, zapisze do talii, odświeży stronę... i talia jest pusta. Dane nie przetrwały, bo gdzieś na trasie middleware → API → baza coś się zgubiło.

Żaden hook tego nie widział, bo operują na kodzie źródłowym. Nie uruchamiają serwera, nie odpytują bazy i nie sprawdzają czy flow użytkownika działa jak należy.

Żeby wyłapać problemy przechodzące przez wiele granic systemu, potrzebujesz testów uruchamiających cały system end-to-end.

Samo narzędzie jednak nie wystarcza. Agent potrafi wygenerować test E2E, ale pytanie czy taki test realnie chroni system przed ryzykiem i przetrwa jutrzejszy refaktor UI?

Oprócz narzędzi potrzebujesz dwóch mechanizmów kontroli: seed testu, który pokazuje agentowi wzorzec dobrego testu E2E, oraz reguł, które sprawią że wygenerowany test będzie wartościowy.

## Które ryzyko wymaga przeglądarki

Zanim cokolwiek zainstalujesz, odpowiedz na pytanie: co ma testować przeglądarka?

Masz **context/foundation/test-plan.md** z pierwszej lekcji tego modułu. Są w nim ryzyka biznesowe uporządkowane według impact i likelihood, a przy każdym najtańsza warstwa, która je udowodni. Tylko część z nich wymaga E2E.

Krótka heurystyka: jeśli ryzyko przechodzi przez wiele granic systemu (auth, routing, API, baza) albo da się je odtworzyć tylko w wyrenderowanym UI, potrzebuje E2E. Jeśli można je sprawdzić na izolowanej funkcji albo na kontrakcie jednego endpointu, wystarczy test jednostkowy lub integracyjny z lekcji o testach jednostkowych (M3L2).

[[nowość]] Ta sama heurystyka na schemacie, razem z ryzykami 10xCards przypisanymi do warstw:

![Która warstwa udowodni ryzyko: najpierw tańszy test, E2E w przeglądarce tylko dla ryzyk przechodzących przez wiele granic, scenariusz API dla aplikacji bez frontendu](https://images.przeprogramowani.pl/lessons/m3-l4/assets/m3l4-diagram-ktora-warstwa.png)

W 10xCards plan testów wskazuje dwa takie ryzyka:

- **Ryzyko #2 — zapis psuje talię.** Użytkownik generuje fiszki, akceptuje jedne, odrzuca inne i zapisuje. Do talii mają trafić tylko zaakceptowane i mają przetrwać odświeżenie strony. Ścieżka przechodzi formularz generowania, API szkiców, zapis do bazy i renderowanie po stronie serwera. Żaden test jednostkowy nie zweryfikuje tego w całości.

- **Ryzyko #3 — bramka autoryzacji.** Niezalogowany użytkownik wchodzi na chronioną stronę i trafia na logowanie, a po zalogowaniu dostaje się do aplikacji. To pełna droga przez middleware, ciasteczko sesji i przekierowania.

Zwrócmy uwagę na ryzyko #1: weryfikacja odpowiedzi z OpenRoutera. Też dotyczy generowania fiszek, ale plan testów wskazuje dla niego testy jednostkowe i integracyjne, a E2E wymienia wprost jako antywzorzec.

E2E nie oznacza braku mockowania. Wewnętrzne granice (auth, routing, baza) zostają prawdziwe, bo to w nich kryją się ryzyka integracyjne. Drogie lub niedeterministyczne zewnętrzne API (modele LLM, bramki płatności) mockujesz na poziomie sieci.

Jeśli twoja aplikacja nie ma frontendu, test E2E to najczęściej scenariusze API: request → routing → logika → baza, bez przeglądarki. Seed, reguły i review działają tak samo, zmienia się tylko warstwa interakcji.

## Playwright w projekcie: /10x-e2e-setup

Pobierz paczkę artefaktów dla tej lekcji:

```
npx @przeprogramowani/10x-cli@latest get m3l4
```

Dostaniesz dwa skille:

- **/10x-e2e-setup** — jednorazowa konfiguracja Playwrighta w projekcie,

- **/10x-e2e** — pętla, która dla danego ryzyka generuje solidny test.

Jeśli chcesz lepiej zrozumieć ich mechanikę, skieruj na te skille prompta skill-explainer z lekcji M1L2.

### Jakie decyzje podejmuje setup

**/10x-e2e** nie instaluje Playwrighta ani nie zajmuje się konfiguracją. Zanim wygeneruje pierwszy test, sprawdza, czy projekt ma konfigurację i seed test. Jeśli czegoś brakuje, odśle Cię do **/10x-e2e-setup**.

Dokładnych kroków setupu nie musisz znać, bo skill wykona je za ciebie. Warto natomiast rozumieć decyzje, które podejmuje, bo te same wybory czekają cię w każdym projekcie z testami E2E, z agentem czy bez niego. Oto cztery najważniejsze:

- **Testujesz build, a nie serwer deweloperski.** Playwright sam buduje aplikację i uruchamia ją przed testami (**webServer**), więc test sprawdza to, co trafi na produkcję.

- **Logujesz się raz.** Projekt setup loguje się przez prawdziwy formularz i zapisuje sesję (**storageState**). Testy startują zalogowane, więc są szybsze i nie padają na logowaniu. Plik sesji i dane użytkownika testowego nigdy nie trafiają do repozytorium.

- **Dane testowe tylko w lokalnym backendzie.** Użytkownika testowego setup zakłada dopiero wtedy, gdy sprawdzi, że baza w **.env** jest lokalna. E2E naprawdę zapisuje dane w bazie, więc pomyłka w adresie może prowadzić do zaśmiecania na produkcji.

- **Reguły poza plikiem reguł agenta.** Skille nie dopisują niczego do **CLAUDE.md**, **AGENTS.md** ani podobnych plików. Reguły E2E leżą w referencjach skilla i ładują się tylko wtedy, gdy pracujesz nad testami E2E, więc nie zajmują kontekstu w innych sesjach.

Wynik to konfiguracja Playwrighta, seed test dla ryzyka i **playwright-cli** podpięty do agenta. Na koniec setup wybiera kolejne ryzyko, które wymaga przeglądarki, i kopiuje do schowka gotową komendę. W 10xCards to **/10x-e2e #2**. Przed commitem przejrzyj seed i **playwright.config.ts**.

![Podsumowanie /10x-e2e-setup i git status bez zmian w CLAUDE.md](https://images.przeprogramowani.pl/lessons/m3-l4/assets/m3l4-01-setup-wynik.png)

## Jak agent widzi aplikację

Kiedy ty otwierasz stronę, widzisz piksele: kolory, fonty, przyciski i układ elementów. Agent domyślnie analizuje drzewo dostępności, a nie piksele.

Drzewo dostępności to ustrukturyzowana mapa całej strony. Każdy element ma swoją rolę (button, textbox, heading), nazwę (to, co screen reader przeczytałby na głos) i stan (disabled, checked, expanded). Przeglądarka buduje to drzewo automatycznie z twojego kodu HTML i ARIA.

Dla agenta ta mapa sprawdza się lepiej niż zrzut ekranu. Jest deterministyczna, zwięzła i nie wymaga modelu wizyjnego. Agent dostaje snapshot w formacie YAML z referencjami do elementów, na przykład **e5** albo **e15**. Potem wydaje komendy: „kliknij **e15**", „wpisz tekst w **e21**". Dostaje nowy snapshot i działa dalej.

![Obraz 2](https://images.przeprogramowani.pl/diagrams/lessons-m3-l4-lesson-draft-1-10x.png)

Dzięki temu agent nie zgaduje selektorów CSS i nie próbuje rozpoznać przycisków na screenshocie. Nawiguje po strukturze semantycznej strony, tak jak czytnik ekranu. Skoro widzi role i nazwy elementów, częściej generuje testy oparte na bardziej solidnych selektorach **getByRole**, zamiast na kruchych selektorach CSS.

### Dlaczego playwright-cli, a nie Playwright MCP

Do przeglądarki agent może sięgnąć przez serwer MCP (**@playwright/mcp**) albo przez CLI (**@playwright/cli**). Nasze skille domyślnie używają CLI z trzech powodów:

- **Stały koszt kontekstu.** Serwer MCP zwykle trzyma w kontekście schematy swoich narzędzi przez całą sesję (w **@playwright/mcp** 0.0.82 to domyślnie około 25 narzędzi). CLI nie dodaje nic, dopóki agent nie wywoła komendy.

- **Snapshoty na dysku.** MCP domyślnie zwraca pełny snapshot w odpowiedzi narzędzia, po każdym kliknięciu od nowa. CLI zapisuje go jako plik YAML w **.playwright-cli/**, a agent czyta tylko potrzebny fragment.

- **CLI jest łatwiejsze w konfiguracji.** **playwright-cli** to kolejne narzędzie w terminalu, bez rejestrowania serwera MCP w każdym narzędziu osobno.

## Dwie dźwignie jakości: seed test i reguły

W lekcji o testach jednostkowych (M3L2) nauczyłeś się dawać agentowi konkretne, powiązane z ryzykiem wejście i wymuszać asercję behawioralną. W E2E tę rolę pełnią dwie dźwignie: seed test i reguły.

Seed test tworzy **/10x-e2e-setup**, a reguły przychodzą razem ze skillami. Twoja rola do przejrzeć i utrzymywać wysoką jakość seed testu, bo to na nim wzoruje się każdy kolejny test.

### Seed test

Seed test jest wzorcem, który agent kopiuje w każdym wygenerowanym teście. Jeśli seed używa **getByRole**, wygenerowane testy częściej będą go używać. Jeśli ma **page.waitForTimeout(2000)**, agent powieli ten antywzorzec wszędzie. Co pokażesz, to dostaniesz.

Dobry seed pokazuje cztery wzorce. Lokatory bierze z roli i nazwy elementu, a nie z klas CSS, bo te same informacje agent widzi w snapshotach. Każdy test jest niezależny od pozostałych, bo przy **fullyParallel: true** nie ma gwarancji kolejności. Czeka na stan strony (**toBeVisible()**, **waitForURL()**, **waitForResponse()**), a nie na upływ czasu. Nazwa i asercja testu wiążą go z konkretnym ryzykiem z **test-plan.md**.

Seed test, który setup napisał dla ryzyka #3 w 10xCards (skrócony):

```
// Seed test — the pattern every generated E2E test copies.
// Protects test-plan.md risk #3 (auth gate).
import { test, expect } from "@playwright/test";

// The risk is the signed-out path, so this test opts out of the saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test("unauthenticated visit to /home is gated by sign-in and returns to /home after signing in", async ({ page }) => {
  // Setup: a visitor without a session opens a protected product route.
  await page.goto("/home");

  // The gate sends them to sign-in, and no learner dashboard is rendered.
  await page.waitForURL("**/auth/signin");
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Witaj ponownie" })).toBeHidden();

  // Action: sign in through the real form (E2E_USERNAME / E2E_PASSWORD).
  // …

  // Assertion: back on /home with a session the middleware accepts.
  await page.waitForURL("**/home");
  await expect(page.getByRole("heading", { name: "Witaj ponownie" })).toBeVisible();
});
```

Przy przeglądzie seeda zadaj pytanie kontrolne: czy ta asercja padnie, jeśli ryzyko się zmaterializuje? Czy zawiera cztery wzorce dobrego testu wymienione powyżej?

### Reguły E2E

Seed pokazuje wzorzec, a reguły go egzekwują. Reguły leżą w referencji **e2e-quality-rules.md**, którą oba skille mają w katalogu **references/**. Setup pisze seed zgodnie z nimi, a **/10x-e2e** czyta je przed wygenerowaniem testu i według nich sprawdza każdy test w REVIEW. Nie trafiają do **CLAUDE.md** ani **AGENTS.md**. Przydają się tylko przy pracy nad testami E2E, więc nie ma powodu, żeby zajmowały kontekst w każdej innej sesji. Obejmują lokatory oparte na roli i nazwie, niezależne testy, czekanie na stan zamiast na czas, asercję wyniku biznesowego, unikalne znaczniki danych ze sprawdzanym sprzątaniem i logowanie przez **storageState**.

Reguły pochodzą z dokumentacji Playwrighta i z doświadczenia; traktuj je jako punkt startowy, a nie dogmat. Konwencje swojego zespołu dopisz do tej referencji w swojej kopii skilla albo pokaż je w seedzie, bo to seed agent kopiuje najwierniej. Jeśli pracujesz na innym frameworku niż Playwright, w tej samej referencji znajdziesz tabelę mapującą każdą zasadę na idiomy Cypressa, WebdriverIO i Selenium.

### Izolacja i sprzątanie

Brak izolacji to najczęstsze źródło fałszywych awarii w E2E: kolejny przebieg trafia na duplikaty, stary stan albo wyczerpany limit. Dlatego skill łączy dwa mechanizmy. Każdy test wkłada do tworzonych danych unikalny znacznik, na przykład **E2E-${Date.now()}**, więc testy nie kolidują nawet przy równoległym uruchamianiu. Po teście **test.afterEach** usuwa to, co test utworzył. Znacznik zapobiega kolizjom, a sprzątanie narastaniu śmieci.

**Sprzątanie, które nie działa.** Najgorsze sprzątanie w testach E2E to takie, które się wykonuje, ale... nic nie usuwa. Test zostaje zielony, a unikalne znaczniki sprawiają, że kolejne przebiegi też nie padają. Jednak śmieci w bazie cały czas przybywa. Warto zweryfikować czy test poprawnie czyści wygenerowany stan. Warto pamiętać, że stan obejmuje więcej niż rekordy: limity, kwoty czy zmienne uprawnienia konta testowego potrafią wywrócić test po kilku przebiegach i wtedy trudniej zrozumieć o co chodzi.

## Pętla /10x-e2e na ryzyku #2

**/10x-e2e** to skill powiązany **/10x-implement** i **/10x-tdd** z lekcji o testach jednostkowych (M3L2). Możesz go wywołać w następujący sposób: **/10x-e2e #2**, który weźmie #2 ryzyko z **test-plan.md** i wygeneruje dopasowany do niego przypadek testowy.

Jednak zanim skill cokolwiek wygeneruje, sprawdza trzy warunki: czy ryzyko naprawdę wymaga przeglądarki, czy funkcja jest już zbudowana, a aplikacja się uruchamia, i czy nie istnieje już test dla tego ryzyka. Ryzyko, które da się udowodnić izolowaną funkcją, trafia do **/10x-tdd** albo **/10x-implement**. Jeśli powiązanej funkcji jeszcze nie ma, skill się zatrzymuje, bo nie mamy czego sprawdzać.

Ryzyko #2 przechodzi wszystkie trzy warunki, więc skill wchodzi w pętlę PLAN → GENERATE → REVIEW → VERIFY. Na diagramie widać ją w całości, z krokiem VERIFY rozpisanym na etapy. Ten sam schemat potwarzamy przy każdym kolejnym ryzyku:

![Pętla /10x-e2e od ryzyka do dowodu: PLAN, GENERATE, REVIEW i VERIFY rozpisany na pięć kroków](https://images.przeprogramowani.pl/lessons/m3-l4/assets/m3l4-diagram-od-ryzyka-do-dowodu.png)

### PLAN: eksploracja przez playwright-cli

Agent zaczyna od aplikacji: buduje ją i uruchamia **preview** w tle na porcie wykrytym przez setup. Potem wczytuje zapisaną sesję i przechodzi ścieżkę ryzyka tak, jak zrobiłby to użytkownik, komendami **playwright-cli** (**goto**, **fill**, **click**, **snapshot**). Każda komenda zapisuje snapshot jako plik YAML w **.playwright-cli/**, a agent czyta z niego tylko potrzebny fragment.

Po lewej mamy widok przeglądu fiszek w interfejsie graficznym. Po prawej jest ten sam ekran w snapshocie, który czyta agent: zawiera role, nazwy i referencje zamiast pikseli.

![Ekran przeglądu fiszek w przeglądarce i ten sam ekran w snapshocie playwright-cli](https://images.przeprogramowani.pl/lessons/m3-l4/assets/m3l4-02-aplikacja-vs-snapshot.png)

Od razu widać materiał na jakościowe lokatory: **getByRole('textbox', { name: 'Tekst źródłowy' })**, przyciski „Akceptuj" i „Odrzuć" w obrębie konkretnego elementu listy, nagłówek „Twoja talia".

Na bazie eksploracji agent tworzy następujący scenariusz:

1. Wygeneruj fiszki z tekstu.

2. Zaakceptuj fiszkę 1, odrzuć fiszkę 2 i poczekaj, aż każda decyzja zostanie zapisana.

3. Zapisz do talii.

4. Na ekranie **/deck** jest fiszka 1, nie ma fiszki 2.

5. Odśwież stronę: stan talii się nie zmienia.

6. Cleanup: usuń zapisane fiszki przez API.

Scenariusz obejmuje jednocześnie "happy path" oraz przypadek wynikający wprost z ryzyka: odrzucona fiszka nie może trafić do talii.

### GENERATE: od przebiegu do speca

Agent wykonuje scenariusz jeszcze raz, krok po kroku, i pisze spec na tej podstawie. Jeden test na plik, komentarz z krokiem scenariusza przed każdą akcją i nagłówek, który wiąże spec z ryzykiem i seedem. Spójrzmy na przykładowe **tests/e2e/generate-review-save.spec.ts**:

```
// risk: test-plan.md #2 — save corrupts the deck: rejected drafts leak into `flashcards`,
//       or accepted cards are not persisted and disappear after a refresh
// seed: tests/e2e/seed.spec.ts

test.describe("risk #2 — save promotes only accepted drafts and they persist", () => {
  const token = `E2E-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  // test.afterEach: cleanup — remove every card this run promoted (via the app's API).

  test("accepted flashcard is saved to the deck and survives a reload; the rejected one never lands", async ({ page }) => {
    // … MOCK: generate from a source text carrying `token`; accept "pytanie 1" and reject "pytanie 2",
    //   waiting for each PATCH /api/drafts/… response before moving on.

    // Save to the deck.
    await page.getByRole("button", { name: "Zapisz do talii" }).click();
    await page.waitForURL("**/deck");

    // The accepted card is in the deck, the rejected one is not.
    await expect(page.getByText(`${token} pytanie 1`)).toBeVisible();
    await expect(page.getByText(`${token} pytanie 2`)).toHaveCount(0);

    // After a full SSR reload the deck still holds exactly the accepted card.
    await page.reload();
    await expect(page.getByText(`${token} pytanie 1`)).toBeVisible();
    await expect(page.getByText(`${token} pytanie 2`)).toHaveCount(0);
  });
});
```

**Mockuj, ale tylko to, czego nie kontrolujesz.** Możemy bezpiecznie sprawdzać zawartość fiszek, ponieważ zwraca je mock zamiast serwisu OpenRouter. Wywoływanie modelu kosztuje, ma limity i odpowiada losowo, więc prawdziwe wywołanie sprawiłoby, że test byłby drogi i niestabilny.

![Co w teście jest prawdziwe, a co mockowane: przeglądarka, aplikacja i lokalny Supabase są prawdziwe, OpenRouter zastępuje lokalny mock](https://images.przeprogramowani.pl/lessons/m3-l4/assets/m3l4-diagram-real-vs-mock.png)

### REVIEW: pięć antywzorców

Dodanie testu nie oznacza jeszcze, że test jest dobry. Agent potrafi optymalizować pod to, żeby test przeszedł teraz, a nie pod to, żeby za miesiąc nadal pilnował ryzyka i nie padał losowo. Wynika to z natury modeli LLM, a nie z wady jednego narzędzia. Dlatego warto robić review zanim zacommitujemy dany test E2E.

**/10x-e2e** przepuszcza każdy wygenerowany test przez checklistę pięciu antywzorców (pełna wersja w referencji **e2e-anti-patterns.md**). W referencji znajdziesz następujące nazwy: Naive assertion, Brittle selector, Shared state, Hardcoded wait, No cleanup. Tak wyglądałyby dla ryzyka #2 z 10xCards:

**1. Naiwna asercja (Naive assertion).** Agent generuje fiszki, akceptuje, zapisuje, odświeża i sprawdza tylko nagłówek „Twoja talia". Test przechodzi. Tyle że nagłówek jest na stronie także wtedy, gdy talia jest pusta albo zawiera odrzuconą fiszkę. Asercja jest poprawna składniowo, ale daje fałszywe poczucie bezpieczeństwa. Pytanie kontrolne: **czy ta asercja padnie, jeśli ryzyko z test-plan.md się zmaterializuje?** Jeśli nie, asercja jest naiwna. Poprawiona wersja sprawdza treść konkretnej fiszki po odświeżeniu i brak fiszki odrzuconej.

**2. Kruchy selektor (Brittle selector).** Agent generuje **page.locator('ul > li:nth-child(1) .btn-accept')** zamiast **getByRole('listitem').filter({ hasText: ... }).getByRole('button', { name: 'Akceptuj' })**. Pierwszy selektor przestanie działać przy prostych zmianach HTML i CSS, nawet jeśli ścieżka użytkownika pozostanie taka sama.

**3. Współdzielony stan (Shared state).** Agent generuje dwa testy: „zapisz fiszki do talii" i „usuń fiszkę z talii", przy czym drugi zakłada, że pierwszy już się wykonał. Przy równoległym uruchamianiu przechodzą raz, a potem padają losowo. Klasyczny flaky test.

**4. Sztywne czekanie (Hardcoded wait).** Agent nie wie, ile trwa generowanie, więc po kliknięciu „Generuj fiszki" wstawia **await page.waitForTimeout(3000)**. Test przechodzi na twoim laptopie i pada na wolniejszej maszynie. Poprawka: **await page.waitForURL('\*\*/generate/\*')** albo **waitForResponse** na zapis decyzji.

**5. Brak cleanupu (No cleanup).** Agent tworzy fiszki, ale ich nie usuwa. Talia konta testowego rośnie z każdym przebiegiem, a asercje oparte na liczbie elementów przestają działać. Unikalny znacznik pozwala łatwiej oddzielić dane testowe od pozostałych na wykorzystywanym środowisku.

**Re-prompt po nazwie.** Ta sama dyscyplina co przy testach jednostkowych (M3L2): nie piszesz „popraw ten test". Nazywasz antywzorzec, wyjaśniasz, dlaczego test nie chroni ryzyka (albo dlaczego produkuje fałszywe awarie), i podajesz wzorzec docelowy. Przykład dla naiwnej asercji na ryzyku #2:

```
Naive assertion: the final check only looks for the "Twoja talia" heading.
It stays visible when the deck is empty or when the rejected card was saved,
so this test passes even when test-plan.md risk #2 materializes.

Assert the business outcome instead: after page.reload(), the accepted card's
front and back are visible and the rejected card has count 0.
The test must fail if the save does not persist or promotes the wrong draft.
```

### VERIFY: zielony to za mało

Ostatni krok nie kończy się na zielonym teście, bo test z naiwną asercją też jest zielony. Pytanie kontrolne trzeba sprawdzić, a nie zakładać w ciemno. Dlatego **/10x-e2e** po wygenerowaniu zielonego testu i jego review wykonuje kolejny krok czyli celowe psucie: osłabia w kodzie dokładnie to zachowanie, którego dotyczy ryzyko, i sprawdza, czy test pada.

Skill cofa zepsucie natychmiast po sprawdzeniu i nigdy go nie commituje. Jeśli test mimo zepsucia zostaje zielony, asercje niczego nie pilnują.

![Raport /10x-e2e z kroku VERIFY: zielono, czerwono na zepsutym kodzie, zero pozostałości, lista zmian produkcyjnych](https://images.przeprogramowani.pl/lessons/m3-l4/assets/m3l4-07-verify-podsumowanie.png)

To ta sama dyscyplina co weryfikacja asercji przez celowe psucie w M3L2, przeniesiona na warstwę E2E.

Automatyczna naprawa testu pomaga, gdy przesunął się element albo zmienił się czas odpowiedzi. Kiedy test pada, bo zmieniło się zachowanie aplikacji, taka naprawa dopasuje asercję do nowego, być może błędnego stanu i zamaskuje regresję.

Pełny przebieg testów E2E często kilka minut, więc najczęściej uruchamia się go podczas CI przy każdym Pull Requeście. Pierwszy pipeline CI stworzysz w kolejnej lekcji, a nasza konfiguracja z setupu pozwoli łatwo agentowi dodać krok testów E2E do tego procesu.

## 🧑🏻‍💻 Zadania praktyczne

1. **Wybierz ryzyko.** Otwórz swój **context/foundation/test-plan.md** i wybierz 2–3 ryzyka, które wymagają przeglądarki: przechodzą przez wiele granic systemu albo istnieją tylko w wyrenderowanym UI. Sprawdź kolumnę z najtańszą warstwą: jeśli plan kieruje ryzyko do testów jednostkowych lub integracyjnych, zostaw je tam.

2. **Uruchom /10x-e2e-setup.** Pobierz paczkę (**npx @przeprogramowani/10x-cli@latest get m3l4**) i uruchom skill w swoim projekcie.

3. **Przejrzyj seed i reguły.** Przeczytaj **tests/e2e/seed.spec.ts** i zadaj pytanie kontrolne: czy ta asercja padnie, jeśli ryzyko się zmaterializuje? Sprawdź, czy seed pokazuje rekomendowane cztery wzorce. Przeczytaj reguły w **references/e2e-quality-rules.md** i dopisz konwencje swojego projektu w swojej kopii skilla.

4. **Przejdź pętlę /10x-e2e na drugim ryzyku.** Obserwuj krok PLAN: jakie snapshoty czyta agent i jaki scenariusz z nich wynika. Przejrzyj spec pod kątem pięciu antywzorców, a znalezione problemy poprawiaj re-promptem po nazwie. W kroku VERIFY sprawdź, że celowe psucie kodu zamieniło test na czerwony. Na koniec sprawdź, czy zepsuty kod został przywrócony do działającego stanu.

5. **Uruchom zestaw testów dwa razy z rzędu.** **npx playwright test**, a potem jeszcze raz. Oba przebiegi muszą być zielone. Jeśli drugi pada, szukaj współdzielonego stanu albo brakującego cleanupu.

6. **(Opcjonalne) Dostosuj skill do swojego kontekstu.** Oba skille to pliki Markdown z referencjami, więc możesz je zmienić ręcznie albo z pomocą dowolnego narzędzia do tworzenia skilli (np. skill-creator w Claude Code) Przykładowo: przepisz seed i reguły na idiomy innego frameworka (tabela mapowania w **e2e-quality-rules.md**), wpisz konwencje zespołu (nazewnictwo, ścieżki, lokatory) albo, dla API bez interfejsu, zamień scenariusze przeglądarkowe na scenariusze API. Uruchom dostosowany skill na wybranym ryzyku i sprawdź, czy wynik respektuje twoje reguły.

## Odbierz swoją odznakę

Po ukończeniu tej lekcji odbierz odznakę w sekcji [10xDevs Mission Log](https://platforma.przeprogramowani.pl/mission-log), a następnie pochwal się swoim osiągnięciem!

## 🔎 Deep Dive

Ta sekcja zawiera dodatkowe pogłębienie wiedzy na temat wybranych zagadnień związanych z lekcją. W tym Deep Dive znajdziesz:

- **Composable fixtures vs Page Object Model** — dlaczego wzorzec POM z drugiej edycji odchodzi do lamusa

- **Teardown jako projekt Playwright** — sprzątanie danych po całym przebiegu

- **Workflow E2E jako skill** — jak zbudowane są **/10x-e2e-setup** i **/10x-e2e** i kiedy taki skill się opłaca (powiązane z opcjonalnym zadaniem)

Ta sekcja lekcji nie jest obowiązkowa, ale warto się z nią zapoznać, jeśli chcesz wejść głębiej.

### Composable fixtures vs Page Object Model

W drugiej edycji kursu uczyliśmy wzorca [Page Object Model](https://playwright.dev/docs/pom): klasy reprezentujące strony, metody reprezentujące interakcje, hierarchia dziedziczenia. W 2026 ten wzorzec ustępuje miejsca composable fixtures z Playwrighta.

Fixtures dają tę samą izolację i wielokrotne użycie co POM, ale bez ceremonii klas, konstruktorów i łańcuchów metod. Fixture, który przygotowuje stronę z konkretnymi danymi testowymi, łatwiej zrozumieć niż klasę **ProductPage** z dwudziestoma metodami.

Kiedy POM nadal ma sens? Przy dużych zestawach testów (ponad 200 testów), gdzie kilku inżynierów potrzebuje wspólnego słownika interakcji ze stronami. Przy mniejszych projektach i przy pracy z agentem wygrywają fixtures.

Porównanie na prostym przykładzie:

```
// POM — klasa z metodami
class DeckPage {
  constructor(private page: Page) {}
  async createDeck(name: string) {
    await this.page.getByRole('button', { name: 'New deck' }).click();
    await this.page.getByRole('textbox', { name: 'Deck name' }).fill(name);
    await this.page.getByRole('button', { name: 'Create' }).click();
  }

  async deleteDeck(name: string) {
    ...
  }
}

// Fixture — funkcja z automatycznym tworzeniem i usuwaniem talii
const test = base.extend<{ deckName: string }>({
  deckName: async ({ page }, use) => {
    const name = `Deck ${Date.now()}`;
    await page.getByRole('button', { name: 'New deck' }).click();
    await page.getByRole('textbox', { name: 'Deck name' }).fill(name);
    await page.getByRole('button', { name: 'Create' }).click();
    await use(name);
    await page.getByRole('button', { name: 'Delete deck' }).click();
  },
});
```

Seed test naturalnie popycha agenta w kierunku fixtures: agent widzi wzorzec setup/teardown w jednej funkcji i powiela go w generowanych testach.

Praktyczna zasada: zacznij od fixtures. Korzystaj z Page Objects dopiero wtedy, kiedy powielona logika interakcji stanie się oczywistym kosztem.

### Teardown jako projekt Playwright

W części głównej omówiliśmy unikalne identyfikatory i cleanup po każdym teście. Dla bardziej złożonych przypadków Playwright oferuje dedykowany mechanizm: teardown project.

Konfiguracja wymaga dwóch kroków. Najpierw projekt setup deklaruje swój teardown:

```
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'setup db',
      testMatch: /global\.setup\.ts/,
      teardown: 'cleanup db',
    },
    {
      name: 'cleanup db',
      testMatch: /global\.teardown\.ts/,
    },
    {
      name: 'chromium',
      use: { storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup db'],
    },
  ],
});
```

Teardown uruchamia się po wszystkich zależnych testach. W **global.teardown.ts** możesz np. czyścić testową bazę danych.

Alternatywne podejście to „teardown-before-setup". Każdy test zaczyna od usunięcia danych, które mógł utworzyć w poprzednim przebiegu. To gwarantuje czysty stan startowy nawet po awarii, bez dedykowanego teardownu. W 10xCards rozwiązałoby to problem osieroconych szkiców z przebiegów, które padły przed zapisem.

### Workflow E2E jako skill

Skille, które dostałeś w tej lekcji, to spakowany przepływ podzielony na dwie części. **/10x-e2e-setup** robi rzeczy jednorazowe: konfigurację, sesję, seed i zapis w **test-stack.md**. **/10x-e2e** robi to, co powtarzasz dla każdego ryzyka: bramkę z trzema warunkami (ryzyko wymaga przeglądarki, funkcja istnieje, testu jeszcze nie ma) i pętlę PLAN → GENERATE → REVIEW → VERIFY.

Kiedy to się opłaca? Pojedynczy prompt i plik reguł wystarczą, dopóki workflow odpalasz sporadycznie. Skill wygrywa, gdy ten sam łańcuch powtarzasz wielokrotnie, w kilku projektach albo w zespole.

Jeśli chcesz zbudować własny skill tego typu, podpatrz cztery decyzje projektowe:

1. **Podział odpowiedzialności.** Pierwszy skill zajmuje się konfiguracją i w tym jest wyspecjalizowany. Drugi skill zajmuje się proces tworzenia jakościowych testów. To dwa odmienna zadania, wymagające różnych instrukcji i referencji, mimo że z pozornie dotyczą tego samego.

2. **Jeden właściciel każdego artefaktu.** Konfigurację i seed tworzy tylko setup, a reguły mają jedno źródło w referencjach skilla. **/10x-e2e** je czyta, a gdy czegoś brakuje, odsyła do setupu, więc nie powstają dwie kopie reguł ani dwa seedy.

3. **Kontrakt między skillami w pliku.** Sekcja **## E2E** w **test-stack.md** ma stałe pola: setup ją pisze, **/10x-e2e** i **/10x-tdd** tylko czytają.

## 📚 Materiały dodatkowe

- [Playwright CLI](https://playwright.dev/agent-cli/introduction) — oficjalna dokumentacja CLI dla agentów: komendy, snapshoty, sesje, porównanie CLI i MCP

- [Playwright webServer](https://playwright.dev/docs/test-webserver) — uruchamianie aplikacji przed testami, **reuseExistingServer**, kilka serwerów naraz

- [Playwright Authentication](https://playwright.dev/docs/auth) — projekt setup i **storageState**: zapis sesji, wiele ról

- [Playwright Visual comparisons](https://playwright.dev/docs/test-snapshots) — **toHaveScreenshot()** i **--update-snapshots**

- [Playwright Best Practices](https://playwright.dev/docs/best-practices) — oficjalne rekomendacje: selektory, izolacja testów, auto-waiting, web-first assertions

- [Playwright MCP](https://github.com/microsoft/playwright-mcp) — serwer MCP Playwrighta: gdy twój agent nie ma terminala; capabilities i konfiguracja

- [Playwright Test Agents](https://playwright.dev/docs/test-agents) — gotowe agenty testowe Playwrighta; alternatywne podejście, z którego nasze skille nie korzystają

- [Playwright Release Notes](https://playwright.dev/docs/release-notes) — browser.bind(), page.screencast, **--debug=cli**, aria snapshots z bounding boxes

- [How I Used AI to Fix Our E2E Test Architecture](https://dev.to/debs_obrien/how-i-used-ai-to-fix-our-e2e-test-architecture-444a) — Debbie O'Brien (Microsoft/Playwright): analiza zestawu testów, plan małymi krokami i powtarzalny skill z bramkami jakości

- [WebTestBench](https://arxiv.org/html/2603.25226) — badanie agentów w testowaniu aplikacji webowych: wszystkie modele poniżej 30% F1, wąskim gardłem jest wykrywanie błędów i niezawodność długich interakcji

- [State of Playwright AI Ecosystem 2026](https://currents.dev/posts/state-of-playwright-ai-ecosystem-in-2026) — Currents.dev, przegląd ekosystemu: MCP vs CLI (tu pojawiają się liczby ~27K vs ~114K), adopcja, nierozwiązane problemy

- [Playwright Best Practices 2026](https://getautonoma.com/blog/playwright-best-practices-2026) — composable fixtures, getByRole, snapshot mode jako domyślny

- [How to Write E2E Tests for Full Parallelization](https://www.qawolf.com/blog/how-to-write-tests-for-full-parallelization) — QA Wolf, unikalne identyfikatory, cleanup i teardown-before-setup

- Prework [\[3.1\]](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/09) _LLMy i ich wpływ na codzienną pracę programisty_ — budżety tokenów i degradacja kontekstu, tutaj zastosowane do decyzji CLI vs MCP

- Prework [\[4.1\]](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/14) _Tech Stack Overview_ — Playwright w rekomendowanym stacku, teraz jako interfejs między agentem a przeglądarką
