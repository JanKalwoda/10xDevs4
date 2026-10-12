---
title: "Hooki i triggery: Agent, który sam reaguje na błędy"
course: "10xdevs-4"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-10-12"
format: "markdown"
---

![Obraz 1](https://images.przeprogramowani.pl/lessons/m3-l3/assets/cover.jpg)

W poprzedniej lekcji pisałeś testy z agentem. Działa? Tak. Pomyśl jednak, ile razy w trakcie sesji z agentem sprawdzałeś lint, typy i testy ręcznie. Ile razy agent edytował plik, a ty po kilku minutach odkrywałeś, że coś nie działa.

Przy pracy nad jednym zadaniem w małym projekcie to nic wielkiego. Z czasem zbierają się z tego jednak godziny stracone na powtarzanie w kółko tego samego cyklu: edycja, ręczna weryfikacja, poprawka i kolejna weryfikacja.

Hooki mogą zrobić to za ciebie, we właściwym momencie: zaraz po tym, jak agent edytuje plik, oraz zanim skończy pracę i odda Ci kontrolę.

## Cykl życia hooka

Zanim skonfigurujesz pierwszy hook, warto poznać wzorzec wspólny dla każdego narzędzia do programowania z AI, które obsługuje ten mechanizm.

Każdy hook składa się z czterech części:

1. **Trigger** — zdarzenie w narzędziu. Na przykład agent właśnie zapisał plik albo za chwilę zakończy odpowiedź.

2. **Matcher** — filtr, który decyduje, czy ten konkretny hook powinien się uruchomić. Może reagować na konkretne narzędzia (np. edycję pliku), typy plików albo wzorce nazw. Nie każde narzędzie traktuje matchery tak samo.

3. **Handler** — komenda, skrypt albo inna akcja, która się wykonuje. Najczęściej to skrypt shellowy, który dostaje kontekst zdarzenia jako JSON na kanale stdin.

4. **Sygnał** — wynik hooka wraca do narzędzia. Exit code mówi, czy wszystko jest w porządku, a komunikat hooka może trafić do agenta jako informacja zwrotna. **Kanał, który faktycznie dociera do agenta, różni się między narzędziami**: w jednym to stderr przy konkretnym exit code, w innym pole w odpowiedzi JSON, a przy niektórych zdarzeniach nie ma go wcale.

![Cykl życia hooka: trigger, matcher, handler i sygnał, który trafia do agenta, do użytkownika albo donikąd](https://images.przeprogramowani.pl/diagrams/lessons-m3-l3-lesson-draft-1-10x.png)

Ostatni krok to najczęstsze źródło problemów. Hook, który się odpala, ale wysyła komunikat złym kanałem, wygląda na działający. Ty widzisz w logach "hook error", agent nie widzi nic i spokojnie pracuje dalej.

## Pierwszy hook w praktyce

Masz wzorzec. Czas podłączyć go do czegoś konkretnego.

Zanim skonfigurujesz pierwszy hook, pobierz paczkę artefaktów dla tej lekcji:

```
npx @przeprogramowani/10x-cli@latest get m3l3
```

Paczka dostarcza dwie rzeczy:

- **Regułę** z modelem hooków z tej lekcji: cyklem życia, momentami uruchamiania sprawdzeń i warstwami lokalnej jakości. Reguła trafia do pliku instrukcji twojego narzędzia, więc agent ma te zasady pod ręką, kiedy pomaga ci konfigurować hooki.

- **Skill /10x-configure-hook**, który zamienia bramki jakości z **context/foundation/test-plan.md** na działające hooki. Sam wykrywa, w jakim narzędziu pracujesz, sprawdza istniejący setup, generuje konfigurację i skrypty we właściwym dla narzędzia protokole i uruchamia je na celowo zepsutym pliku, zanim odda ci wynik. Szczegóły per narzędzie (nazwy zdarzeń, pola w payloadzie, kanał sygnału) trzyma w referencjach wraz z linkiem do dokumentacji.

Ze skilla skorzystasz w zadaniu praktycznym. Najpierw zobacz, co dokładnie wygeneruje, na przykładzie najczęstszego pierwszego hooka: statycznej analizy (lint) po każdej edycji pliku.

Hook składa się z dwóch części: wpisu w ustawieniach, który określa, *kiedy* hook ma się odpalić, oraz krótkiego skryptu, który wykonuje logikę. Zobaczmy przykładową konfigurację w **.claude/settings.json**:

```
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/lint-edited-file.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

A tutaj przykładowy skrypt **.claude/hooks/lint-edited-file.sh** - nie kopiuj go, skill wygeneruje podobne dla Twojego projektu:

```
#!/usr/bin/env bash
# PostToolUse (Write|Edit): lintuje plik, który agent właśnie edytował
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
export NO_COLOR=1 FORCE_COLOR=0   # czysty tekst: wynik czyta model, nie trafia do terminala

# Kontekst zdarzenia przychodzi jako JSON na stdin
FILE=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Tylko pliki, które obsługuje linter (listę weź z jego konfiguracji)
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0

# Tylko edytowany plik, nie cały projekt
if ! OUTPUT=$(npx eslint --quiet "$FILE" 2>&1); then
  echo "ESLint zgłosił błędy w $FILE:" >&2
  echo "$OUTPUT" >&2
  exit 2   # w Claude Code do agenta trafia tylko przez kanał stderr z kodem wyjścia 2
fi
exit 0
```

Jak to działa? Agent edytuje plik narzędziem Write albo Edit. Hook **PostToolUse** uruchamia się po tej akcji, a matcher **Write|Edit** sprawdza, czy narzędzie pasuje. Skrypt wyciąga ze stdin ścieżkę edytowanego pliku (**tool\_input.file\_path**), lintuje tylko ten plik i przy błędach przekazuje je agentowi.

Detale, które łatwo przeoczyć:

- **Tylko edytowany plik.** Wywołanie **eslint --fix .** po każdej edycji działa powoli, modyfikuje pliki, których agent nie dotykał, i zgłasza stare błędy z innych miejsc. Agent dostaje wtedy szum zamiast sygnału.

- **Bez --fix.** Automatyczna poprawka nadpisuje plik zmodyfikowany przed chwilą przez agenta, przez co jego kolejna edycja może się wyłożyć komunikatem "plik zmienił się od odczytu". Lepiej zgłosić błąd i pozwolić agentowi nanieść poprawkę.

- **timeout** w Claude Code podajesz w **sekundach**, a nie w milisekundach.

- **$CLAUDE\_PROJECT\_DIR** wskazuje katalog główny projektu, dzięki czemu ścieżka do skryptu działa niezależnie od bieżącego katalogu roboczego agenta.

Pracujesz na Windowsie? Claude Code uruchamia hooki przez Git Bash. Bez niego lub bez narzędzia **jq** poproś agenta o wersję skryptu w Node.js.

## Agent widzi i reaguje

Tutaj widać różnicę między hookiem agentowym a klasycznym hookiem gita.

Hook gitowy może tylko przepuścić commit albo go zatrzymać. Hook agentowy potrafi dodatkowo poinstruować agenta, co dokładnie poszło nie tak. Dzieje się tak jednak tylko wtedy, gdy użyjesz kanału, którego narzędzie rzeczywiście nasłuchuje. W Claude Code decyduje o tym exit code:

- **0** — sukces. Agent kontynuuje. To, co hook wypisze na stdout po edycji i na koniec pracy, **nie trafia do agenta**; ląduje jedynie w logu debugowania.

- **2** — błąd blokujący. Treść ze **stderr** trafia do agenta. Po edycji oznacza to informację zwrotną do tej konkretnej zmiany (sama edycja zdążyła się już wykonać), a na koniec pracy sygnał: "jeszcze nie kończ".

- **każdy inny** — błąd nieblokujący. Widzisz wtedy komunikat "hook error", a **agent nie widzi nic**.

Warto o tym pamiętać, bo wiele narzędzi domyślnie działa w sposób niekompatybilnym z takimi wymaganiami. Przykłądowo ESLint i Vitest przy wykrytych błędach zwracają **1**, nie 2, i piszą na **stdout**. Hook w stylu **"command": "npx eslint --fix ."** odpala się, ty widzisz "hook error", ale agent nie dostaje informacji z błędami.

![PostToolUse zwraca blocking error z komunikatem „No stderr output”, a agent pisze, że nie widzi przyczyny i uruchomi sprawdzenia sam](https://images.przeprogramowani.pl/lessons/m3-l3/assets/hooks-01-przed-hook-bez-kanalu.png)

Hooki odpalają się i blokują agenta, ale ten dostaje tylko "No stderr output", więc sam zgaduje, co jest nie tak, i próbuje naprawić ręcznie, często inny problem.

Dlatego skrypt wyfenerowany przez nasz skill przekierowuje wynik na stderr (**>&2**) i zamienia każdą porażkę na **exit 2**. To cała "magia".

![Hook lint-edited-file.sh po edycji DeckBrowser.tsx: ESLint zgłasza trzy nieużywane importy z numerami linii i nazwą reguły](https://images.przeprogramowani.pl/lessons/m3-l3/assets/hooks-02-po-edycji-agent-dostaje-blad.png)

Co to oznacza w praktyce? Jeśli lint, typecheck lub test zwróci błąd, agent zobaczy precyzyjny komunikat: brakujący typ, niezaimportowany moduł czy padającą asercję. Dzięki temu może naprawić usterkę sam w kolejnej iteracji, bez angażowania ciebie.


Pojawia się tu jednak naturalna granica. Drobne poprawki, takie jak formatowanie, brakujący import czy definicja typu, agent rozwiąże bez problemu. Kiedy jednak test wyłoży się przez błąd w logice biznesowej, hook wskaże usterkę, ale agent nie zawsze poprawnie zdiagnozuje jej źródło i może próbować powierzchownych łatek dających jedynie złudzenie sukcesu.

Przy bardziej złożonych problemach, gdy agent sam sygnalizuje brak postępów lub jego poprawka jest niesatysfakcjonująca, powinieneś pogłębić analizę i wspólnie z agentem dojść do sedna w toku rozmowy.

Dla najtrudniejszych przypadków warto otworzyć osobną zmianę z pełnym procesem: /10x-new → /10x-research (opcjonalnie) → /10x-plan → /10x-implement.

## Typecheck na koniec pracy agenta

Gdy linter działa, kolejnym krokiem staje się weryfikacja typów. Typecheck weryfikuje jednak cały projekt, a nie pojedynczy plik. Uruchamiany po każdej edycji działa powoli i wprowadza chaos: w trakcie zmian w wielu plikach typy tymczasowo się nie zgadzają, przez co agent dostaje błędy, które sam za moment by poprawił.

Lepszym momentem na taką kontrolę jest koniec pracy agenta. W Claude Code odpowiada za to zdarzenie **Stop**: uruchamia się, gdy agent kończy generować odpowiedź. Exit code 2 oznacza w tym kontekście "jeszcze nie kończ", dzięki czemu agent zapoznaje się z błędami i wraca do pracy. Inne narzędzia oferują zbliżone odpowiedniki tego zdarzenia.

Wiąże się z tym ryzyko: gdyby agent nie potrafił naprawić błędu, hook zapętliłby go w nieskończoność. Z tego powodu skrypt sprawdza pole **stop\_hook\_active**, informujące, że agent wrócił już do pracy z powodu tego hooka:

```
# Stop: agent już zareagował na ten hook? Pozwól mu skończyć.
if [ "$(jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

if ! OUTPUT=$(npx tsc --noEmit --pretty false 2>&1); then
  echo "Typecheck nie przechodzi. Popraw te błędy, zanim skończysz:" >&2
  echo "$OUTPUT" >&2
  exit 2
fi
```

Agent dostaje jedną szansę na poprawkę, a ewentualne pozostałe błędy wychwyci bramka pre-commit lub CI.

Hook na koniec pracy ma też drugą rolę: to siatka bezpieczeństwa dla całej interakcji. Hook po edycji widzi tylko zmiany wprowadzone narzędziami Write i Edit. Agent potrafi jednak zmienić plik poleceniem w terminalu (np. **cat > plik <<EOF** albo **sed -i**), a takiej edycji hook **PostToolUse** z matcherem **Write|Edit** w ogóle nie zauważy. Dlatego skill generuje skrypt, który przed oddaniem ci kontroli zbiera wszystkie pliki zmienione w tej turze (**git diff**), uruchamia na nich lint i testy, a na końcu typecheck całego projektu.

## Jak dopasować hook do sytuacji?

Hooki mają swoją cenę: blokują pętlę pracy agenta. Dopóki skrypt się nie wykona, agent czeka. To celowy mechanizm, bo agent potrzebuje informacji zwrotnej przed kolejnym krokiem. Jeśli jednak weryfikacja trwa 30 sekund i uruchamia się przy każdej zmianie, w skali sesji oznacza to minuty oczekiwania pomnożone przez dziesiątki edycji.

Praktyczna heurystyka: **im wolniejsze sprawdzenie, tym rzadszy moment.**

- **Po każdej edycji** — lint i format pojedynczego pliku oraz powiązane testy, o ile wykonują się w kilka sekund.

- **Na koniec pracy agenta** — typecheck całego projektu i szerszy zestaw testów.

- **Commit albo push** — weryfikacje trwające dłużej niż kilkadziesiąt sekund oraz pełny zestaw testów.

Najbardziej wartościowy hook po edycji uruchamia testy powiązane bezpośrednio ze zmienionym plikiem. Zamiast całego zestawu wykonuje tylko te, które importują edytowany moduł. Przykładowo w Vitest odpowiada za to polecenie **vitest related src/server/auth.ts --run** (**related** to subkomenda, nie flaga; **--run** zapobiega wejściu Vitesta w tryb watch). Gdy dany plik nie ma przypisanych testów, komenda kończy się sukcesem, więc hook nie wywołuje fałszywych alarmów.

Hook po edycji uruchamia się przy każdym użyciu narzędzia: modyfikacja trzech plików oznacza trzy oddzielne uruchomienia. Jeżeli testy trwają zbyt długo, zawęź w skrypcie listę plików, które je wyzwalają (na przykład ograniczając się do kluczowych katalogów), albo przenieś ich uruchamianie na moment zakończenia pracy agenta.

Obserwuj, jak hook wpływa na tempo pracy agenta, i dostosuj. Jeśli zaczyna cię irytować, to sygnał, że sprawdzenie powinno zmienić moment albo działać na mniejszym zestawie plików.

## Trzy warstwy lokalnej jakości

Hooki agentowe to dopiero pierwsza warstwa. Pełny model lokalnej jakości składa się z trzech warstw plus CI jako czwartej:

![Trzy lokalne warstwy jakości i CI: hooki agentowe po edycji i na koniec pracy (sekundy), pre-commit, pre-push i CI (minuty)](https://images.przeprogramowani.pl/diagrams/lessons-m3-l3-lesson-draft-4-10x.png)

**Hooki agentowe (po edycji i na koniec pracy)** działają najszybciej. Łapią formatowanie, błędy typów i padające testy jednostkowe. To warstwa, która podaje agentowi feedback w trakcie jego pracy.

**Pre-commit (hooki gitowe)** zabezpieczają przed tym, co pominął agent: zmianami wprowadzonymi ręcznie, plikami zmodyfikowanymi poza hookiem oraz testami zbyt wolnymi dla pętli agenta. Pracują na staged files, weryfikując dokładnie zawartość przyszłego commita.

**Pre-push** uruchamia bardziej wymagające procesy przed pushem brancha, na przykład pełen zestaw testów.

**CI** to ostateczna warstwa bezpieczeństwa: sprawdza integrację całości, współdzielony stan repozytorium oraz konfigurację infrastruktury niedostępnej lokalnie.

Skill /10x-configure-hook nie zapisuje konfiguracji hooków gitowych. W raporcie podpowie jednak, co warto przenieść do pre-commit i pre-push, ale decyzja i konfiguracja dostosowana do stacku technologicznego zostaje po twojej stronie.

Warstwy lokalne nie zastępują CI, ale każda wychwycona w nich usterka oszczędza czas czekania na wynik pipeline CI.

## Sygnał w różnych narzędziach

Cykl życia hooka jest wszędzie ten sam. Rozjeżdża się ostatni krok: którym kanałem wynik hooka dociera do agenta. Hook skopiowany 1:1 z jednego narzędzia do drugiego zwykle się odpala, ale agent go nie widzi.

![Kanał sygnału per narzędzie: Claude Code (stderr przy exit 2), Cursor (JSON additional_context), Codex (stderr przy exit 2 albo JSON), Copilot (JSON additionalContext lub stderr zależnie od runtime'u)](https://images.przeprogramowani.pl/diagrams/lessons-m3-l3-lesson-draft-2-10x.png)

Format wprowadzony przez Claude Code staje się nieformalnym standardem: interpretują go Cursor i Copilot, a Codex powiela jego schemat. Zdolność odczytania tego samego pliku konfiguracyjnego nie oznacza jednak obsługi tego samego kanału komunikacji. Z tego powodu skill przechowuje specyfikację poszczególnych narzędzi w plikach referencyjnych wraz z linkami do dokumentacji.

Szczegóły dla Claude Code, Cursora, Codexa i Copilota (zdarzenie po edycji, kanał do agenta i typowa pułapka) znajdziesz w Deep Dive, w części "Kanały sygnału per narzędzie".

## Jak sprawdzić, czy hook działa

To, że hook się uruchamia, nie oznacza jeszcze pełnego sukcesu. Sprawdź trzy rzeczy: poprawność rejestracji, sam start skryptu oraz to, czy agent faktycznie odbiera wynik.

**1. Przetestuj skrypt bez agenta.** Hook to zwykły skrypt odczytujący JSON ze stdin, możesz go więc uruchomić ręcznie na dowolnym pliku (przykładowo **src/lib/auth.ts** — dostosuj do swojego projektu):

```
echo '{"tool_name":"Edit","tool_input":{"file_path":"'"$PWD"'/src/lib/auth.ts"}}' | .claude/hooks/lint-edited-file.sh
echo "exit code: $?"
```

Wprowadź celowy błąd do pliku i upewnij się, że skrypt zwraca blokujący kod wyjścia oraz czytelną treść błędu. Następnie cofnij zmianę i potwierdź, że skrypt kończy się sukcesem. W ten sposób najszybciej wyłapiesz pomyłki w logice skryptu przed włączeniem w proces agenta. Skill /10x-configure-hook wykonuje ten sam test przed zakończeniem konfiguracji.

**2. Sprawdź, czy narzędzie widzi hook.** W Claude Code polecenie **/hooks** wyświetla listę zarejestrowanych hooków wraz z ich plikiem źródłowym. Jeśli brakuje twojego skryptu, zweryfikuj go z agentem i zrestartuj sesję.

**3. Sprawdź, co się dzieje w trakcie pracy agenta.**

- W Claude Code skrót **Ctrl+O** otwiera szczegóły pracy agenta, gdzie zobaczysz informacje o wywoływanych hookach.

- Uniwersalnym rozwiązaniem dla każdego narzędzia jest dopisanie przekierowania logów do pliku w ramach skryptu wywoływanego przez hooka:

```
echo "[$(date '+%H:%M:%S')] lint: $FILE" >> /tmp/hooks.log
```

W osobnym terminalu wpisz **tail -f /tmp/hooks.log**. Zobaczysz wtedy, czy hook wystartował, jak często się odpala i jakie pliki przetwarza.

## Hooki a test-plan.md

Wróćmy do punktu wyjścia. W pierwszej lekcji tego modułu stworzyłeś **context/foundation/test-plan.md** ze strategią i bramkami jakości, w lekcji drugiej pisałeś testy na podstawie obszarów ryzyka.

Hooki zamykają tę pętlę: zamieniają bramki z deklaracji w automatyczną weryfikację. Przy każdej bramce z sekcji **Quality Gates** pytasz o moment: czy to sprawdzenie jest wystarczająco szybkie na per-edit? Czy powinno poczekać na koniec pracy agenta albo commit? A może potrzebuje pełnego środowiska i należy do pre-push albo CI?

![Bramki z sekcji Quality Gates w test-plan.md przypisane do momentów: po edycji, koniec pracy agenta, commit, push i CI](https://images.przeprogramowani.pl/diagrams/lessons-m3-l3-lesson-draft-3-10x.png)

To mapowanie wykonuje za ciebie skill: czyta sekcję Quality Gates, przypisuje każdą bramkę do momentu według heurystyki i przekazuje rekomendacje.

 Zacznij tam, gdzie stosunek kosztu do sygnału jest najlepszy dla twojego projektu.

Nie musisz skonfigurować tego perfekcyjnie za pierwszym razem. Dodawaj kolejne warstwy, gdy zobaczysz, jakie problemy ci uciekają.

Hooki wyłapują błędy w kodzie: formatowanie, typy i testy jednostkowe. Nie wykryją jednak problemów widocznych dla użytkownika, takich jak przesunięcia elementów interfejsu, błędy nawigacji czy niedostępne formularze. Do ich weryfikacji potrzebna jest przeglądarka, Playwright i scenariusze E2E, którymi zajmiemy się w kolejnej lekcji.

## 🧑🏻‍💻 Zadania praktyczne

### Skonfiguruj hooki skillem /10x-configure-hook

W projekcie kursowym (po wykonaniu **npx @przeprogramowani/10x-cli@latest get m3l3**) skonfiguruj hooki:

1. **Uruchom skill** **/10x-configure-hook** w swoim narzędziu (Claude Code, Cursor, Codex albo Copilot). Przejrzyj propozycję: które bramki z **test-plan.md** chce wykorzystać oraz jakie usterki skill znalazł w istniejących hookach. Zatwierdź, popraw albo odrzuć.

2. **Zweryfikuj ręcznym testem.** Uruchom wygenerowany skrypt z przykładowym JSON-em na stdin (zgodnie ze wskazówkami z sekcji "Jak sprawdzić, czy hook działa") najpierw na pliku ze sztucznie wprowadzonym błędem, a potem na poprawnym. W pierwszym przypadku upewnij się, że otrzymujesz blokujący kod wyjścia i zrozumiały komunikat, a w drugim potwierdzenie sukcesu. Na koniec wycofaj wprowadzony błąd.

3. **Wprowadź błąd i obserwuj agenta.** Poproś agenta o modyfikację pliku skutkującą błędem lintera, a następnie błędem typowania. Sprawdź, czy agent samodzielnie wychwytuje obie usterki i koryguje je w trakcie tej samej sesji, a hook końcowy odsyła go do poprawki najwyżej raz.

Jeśli hook odpala się, ale agent nie reaguje, to prawie zawsze problem z kanałem albo exit code — porównaj go z częścią "Kanały sygnału per narzędzie" w Deep Dive. W Codex upewnij się też, że hooki zostały zatwierdzone przez **/hooks**.

### (Opcjonalne) Dodaj scoped test trigger

Wybierz obszar o najwyższym ryzyku z pliku **context/foundation/test-plan.md** i dodaj hook po edycji uruchamiający tylko testy powiązane z danym modułem. Konfigurację możesz zlecić skillowi lub bezpośrednio agentowi.

- Przetestuj działanie ręcznie: przykładowy JSON wskazujący plik z padającym testem powinien wywołać sygnał blokujący (błąd musi skutkować niepoprawną asercją w testach).

- Zleć agentowi edycję pliku w obszarze ryzyka i zaobserwuj, czy powiązane testy wystartują.

- Zmodyfikuj plik spoza modułu, aby upewnić się, że testy nie są niepotrzebnie uruchamiane.

### (Opcjonalne) Dodaj bramkę pre-commitową

Dodaj do projektu hook gitowy **pre-commit**, który przed zatwierdzeniem commita zweryfikuje lint i testy na staged files. Możesz oprzeć się na rekomendacji z raportu wygenerowanego przez skill. Narzędzie dobierz do specyfiki swojego projektu. Jeśli nie masz wyrobionych preferencji, przeprowadź research wspólnie z agentem.

Jeśli chcesz zrozumieć, na czym te narzędzia bazują, zajrzyj do [dokumentacji git hooks](https://git-scm.com/docs/githooks) — opisuje **pre-commit** i pozostałe hooki gita, które te narzędzia tylko opakowują.

## Odbierz swoją odznakę

Po ukończeniu tej lekcji odbierz odznakę w sekcji [10xDevs Mission Log](https://platforma.przeprogramowani.pl/mission-log), a następnie pochwal się swoim osiągnięciem!

## 🔎 Deep Dive

Ta sekcja zawiera dodatkowe informacje o wybranych zagadnieniach z lekcji. W tym Deep Dive znajdziesz:

- **Kanały sygnału per narzędzie** — którym kanałem wynik hooka trafia do agenta w Claude Code, Cursorze, Codexie i Copilocie.

- **Performance hooków** — jak pogodzić dokładność sprawdzeń z szybkością pętli agenta.

- **Inne typy handlerów** — co jeszcze potrafią hooki poza komendami shell.

- **Niezawodność hooków** — kiedy hook może się nie odpalić i jak to zdiagnozować.

Ta sekcja lekcji nie jest obowiązkowa, ale warto do niej zajrzeć.

### Kanały sygnału per narzędzie

- **Claude Code** | **Po edycji**: **PostToolUse** z matcherem **Write|Edit** | **Do agenta dociera**: stderr przy exit 2 (albo odpowiedź JSON) | **Pułapka**: exit 1 i stdout, czyli domyślne zachowanie linterów i test runnerów, które agent pomija.

- **Cursor** | **Po edycji**: **postToolUse** z matcherem **Write** | **Do agenta dociera**: JSON na stdout z polem **additional\_context**; na koniec pracy **stop** z **followup\_message** | **Pułapka**: **afterFileEdit** wygląda na naturalny wybór, ale służy tylko do obserwacji (np. formatterów); nic, co wypisze, nie trafia do agenta. Cursor domyślnie importuje też hooki z **.claude/settings\*.json**, więc w repozytorium używanym z oboma narzędziami łatwo wykorzystać ten sam hook.

- **Codex** | **Po edycji**: **PostToolUse** na narzędziu **apply\_patch** | **Do agenta dociera**: stderr przy exit 2 albo JSON **{"decision": "block", "reason": "..."}** | **Pułapka**: edycje przychodzą jako patch, bez **tool\_input.file\_path**. Ścieżki trzeba wyciągnąć z treści patcha, a skrypt czytający **file\_path** po cichu przepuszcza każdą edycję. Do tego nowe i zmienione hooki nie odpalą się, dopóki nie przejrzysz ich i nie zatwierdzisz komendą **/hooks**, po każdej zmianie od nowa. To bariera bezpieczeństwa, bo hook w repozytorium to kod, który ktoś mógł przemycić w pull requeście. Hook, który pozornie nie reaguje, to w Codexie często brak zatwierdzenia w /hooks, a nie błędna składnia.

- **Copilot** | **Po edycji**: **postToolUse** (CLI) / **PostToolUse** (VS Code) | **Do agenta dociera**: w CLI JSON z **additionalContext** (exit 2 to tu tylko ostrzeżenie); w VS Code stderr przy exit 2 albo **additionalContext** | **Pułapka**: trzy runtime'y (CLI, VS Code, Cloud Agent) z różnymi schematami. VS Code ignoruje matchery w plikach w formacie Claude, więc hook odpala się przy każdym narzędziu, także przy odczycie pliku. Nazwy narzędzi i pól w payloadzie też różnią się od Claude Code, więc skrypt przeniesiony 1:1 może dostać pustą ścieżkę i przepuszczać wszystko.

### Performance hooków

Claude Code oferuje dodatkowe mechanizmy ograniczające obciążenie pętli agenta:

- **PostToolBatch** wykonuje się jednorazowo po całej serii równoległych wywołań narzędzi zamiast po każdej pojedynczej edycji.

- **async: true** odpala hook w tle bez wstrzymywania pracy agenta. Taki proces nie zablokuje wykonania, ale może dostarczyć **additionalContext**, który agent odczyta w kolejnej turze. To dobre rozwiązanie dla logowania, statystyk czy notyfikacji.

- **asyncRewake: true** przydaje się przy weryfikacji jakości: skrypt działa w tle, a w razie zakończenia kodem exit 2 wznawia pracę agenta i przekazuje mu zawartość stderr nawet wtedy, gdy sesja pozostawała bezczynna. To odpowiednie miejsce na wolniejszy zestaw testów: agent nie czeka na wynik przy każdej edycji, ale otrzyma informację w razie wystąpienia problemu.

### Inne typy handlerów

Oprócz standardowego typu **command** Claude Code obsługuje alternatywne typy handlerów:

- **http** — wysyła input hooka do zewnętrznego endpointu. Przydatny w zespołach, które centralizują logikę sprawdzeń na serwerze.

- **mcp\_tool** — wywołuje narzędzie MCP. Hook korzysta z tego samego ekosystemu narzędzi co agent.

- **prompt** — przesyła dane wejściowe hooka do szybkiego modelu, który zwraca decyzję (**ok**) wraz z uzasadnieniem (**reason**). Metoda sprawdza się przy ocenach trudnych do ujęcia w sztywne reguły skryptu. Domyślny timeout wynosi 30 sekund.

- **agent** — powołuje mini-agenta z dostępem do narzędzi w odpowiedzi na zdarzenie. Domyślny timeout wynosi 60 sekund. Na ten moment lepiej traktować to jako eksperyment niż rozwiązanie do codziennego użytku.

W innych narzędziach zestaw opcji jest skromniejszy. Cursor wspiera **command** i **prompt**. Codex obsługuje **command** oraz **mcp\_tool**, a definicje **prompt** i **agent** przetwarza syntaktycznie, ale ich nie wykonuje. W Copilocie **prompt** oznacza tekst dołączany na początku sesji, a nie ewaluator oparty na LLM.

PreToolUse hooki w Claude Code potrafią też modyfikować dane wejściowe narzędzia (przez **updatedInput**) i podejmować decyzje o uprawnieniach (**allow**, **deny**, **ask**, **defer**). Otwiera to ciekawą możliwość: hook, który dodaje kontekst do operacji agenta albo blokuje niebezpieczne akcje, zanim się wykonają.

### Niezawodność hooków

Hooki są deterministyczne: konfiguracja określa warunki, a środowisko uruchamia skrypt. Narzędzie musi jednak faktycznie wyzwolić ten proces, co nie zawsze dzieje się automatycznie.

Dlaczego warto zainwestować w hooki? To warstwa deterministyczna. Przetrwają kompresję kontekstu, zmianę instrukcji systemowych, "zapomnienie" przez model. Instrukcja w pliku reguł może zostać skompresowana albo zignorowana. Hook odpali się w wyznaczonym momencie, bo działa poza modelem, w środowisku uruchamiającym (harnessie).

## 📚 Materiały dodatkowe

- [Claude Code Hooks](https://code.claude.com/docs/en/hooks) — oficjalna dokumentacja: zdarzenia, handlery, matchery, exit codes, **stop\_hook\_active**, konfiguracja na wielu poziomach

- [Cursor Hooks](https://cursor.com/docs/hooks) — dokumentacja hooków: zdarzenia, **postToolUse** z **additional\_context**, **stop** z **followup\_message**, opcja **failClosed**

- [Codex Hooks](https://learn.chatgpt.com/docs/hooks) — dokumentacja hooków Codex: zdarzenia, payload **apply\_patch**, model zaufania oparty na hashach

- [Devin Desktop Hooks](https://docs.devin.ai/desktop/cascade/hooks) — dokumentacja hooków Devin Desktop (dawniej Windsurf Cascade): zdarzenia i ograniczenia post-hooków

- [GitHub Copilot Hooks Reference](https://docs.github.com/en/copilot/reference/hooks-reference) — dokumentacja hooków Copilot CLI i cloud agenta: zdarzenia, payload, **additionalContext**

- [VS Code Agent Hooks](https://code.visualstudio.com/docs/agent-customization/hooks) — hooki w VS Code: lokalizacje konfiguracji, różnice względem formatu Claude Code (ignorowane matchery)

- [Gemini CLI Hooks](https://geminicli.com/docs/hooks/) — dokumentacja hooków Gemini CLI: **AfterTool**, **AfterAgent**, matchery i kanały sygnału

- [Vitest CLI](https://vitest.dev/guide/cli.html) — dokumentacja CLI z subkomendą **related** i flagą **--changed** do uruchamiania testów powiązanych z plikiem

- [Vitest 4.1](https://vitest.dev/blog/vitest-4-1.html) — agent reporter, kompaktowe wyjście dla agentów AI, **AI\_AGENT=1**

- [Lefthook](https://github.com/evilmartians/lefthook) — git hook manager z jednym plikiem YAML, interpolacją **{staged\_files}** i **stage\_fixed**, bez zależności od Node.js

- [pre-commit](https://pre-commit.com/) — wielojęzykowy framework do hooków gitowych, de facto standard w ekosystemie Pythona, z gotowym katalogiem hooków dla wielu narzędzi

- [Git Hooks](https://git-scm.com/docs/githooks) — oficjalna dokumentacja gita: hook **pre-commit** i pozostałe punkty zaczepienia, na których bazują Husky, Lefthook i pre-commit

- [1Password agent-hooks](https://github.com/1Password/agent-hooks) — jedno źródło hooków instalowane do kilku narzędzi naraz, praktyczny dowód podobieństwa architektury hooków

- [Git Hooks with Lefthook](https://stevekinney.com/courses/self-testing-ai-agents/git-hooks-with-lefthook) — Steve Kinney, praktyczny setup Lefthook w kontekście AI agent workflows

- [AI agent hooks](https://www.speakeasy.com/resources/ai-agent-hooks) — Speakeasy, analiza hooków jako interfejsu kontroli agentów AI

- [Commit Hooks with AI Agents](https://egghead.io/commit-hooks-are-critical-with-ai-agents-in-cursor~jhoer) — Egghead.io, dlaczego pre-commit hooki są kluczowe przy pracy z agentami

- Prework [\[2.4\]](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/07) *Agent-Native IDE* — dyscyplina bezpieczeństwa (czysty repo, testy, review, diffy), którą hooki automatyzują

- Prework [\[1.3\]](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/03) *Jak uczyć się i rozwijać z AI* — tryb korepetytora, tutaj zastosowany do hooka, który uczy agenta reagować na błędy

- Prework [\[2.2\]](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/05) *Cursor — Podstawy operacyjne* i [\[2.3\]](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/06) *Claude Code — Podstawy operacyjne* — podstawy konfiguracji narzędzi, na których opiera się konfiguracja hooków
