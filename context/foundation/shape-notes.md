---
project: "DryFire Drill Timer"
context_type: greenfield
product_type: web-app
target_scale:
  users: small
created: 2026-09-16
updated: 2026-09-18
timeline_budget:
  mvp_weeks: 2
  hard_deadline: 2027-01-10
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "Typ kontekstu projektu"
      decision: "Greenfield — użytkownik potwierdził budowę nowej aplikacji od zera."
    - topic: "Pierwszy użytkownik i obecne rozwiązanie"
      decision: "Autor projektu ćwiczy na sucho z timerem HIIT; brakuje mu losowego startu z zadanego przedziału."
    - topic: "Cel losowego startu"
      decision: "Start ma wymuszać reakcję na sygnał, zamiast pozwalać na przygotowanie reakcji dzięki przewidywalnemu czasowi."
    - topic: "Rozdzielczość losowania a dokładność sygnału"
      decision: "Wartości opóźnienia są losowane co 0,01 s. Akceptowalny bezwzględny błąd momentu sygnału względem zaplanowanego momentu wynosi maksymalnie 0,2 s."
    - topic: "Role i własność konfiguracji"
      decision: "Jeden rodzaj konta; każdy zarządza wyłącznie własnymi konfiguracjami."
    - topic: "Metoda logowania"
      decision: "Magic link — jednorazowy link wysyłany na adres email użytkownika."
    - topic: "Tworzenie konta"
      decision: "Pierwsze poprawne użycie magic linku tworzy konto; kolejne loguje do istniejącego konta, bez osobnego formularza rejestracji."
    - topic: "Dostęp bez logowania"
      decision: "Timer jest dostępny bez logowania. Konto jest potrzebne do zapisywania własnych konfiguracji."
    - topic: "Wprowadzanie i prezentacja czasu"
      decision: "Ustawienia czasu w pełnych sekundach; losowanie co 0,01 s. Losowe oczekiwanie pokazuje Standby bez odliczania; podgląd następnej fazy pokazuje ćwiczenie i jego pełny czas. Pozostałe fazy pokazują swój czas."
    - topic: "Budżet MVP"
      decision: "Całe MVP: 2 tygodnie przy zaangażowaniu 10–15 godzin tygodniowo."
    - topic: "Dodatkowe kryterium sukcesu i warunki konieczne"
      decision: "Wygodna obsługa konfiguracji i uruchamiania timera na telefonie; konfiguracje konta dostępne wyłącznie właścicielowi; Standby nie ujawnia pozostałego czasu ani momentu startu."
    - topic: "Sterowanie przebiegiem"
      decision: "Zatrzymanie oznacza pauzę z możliwością wznowienia; anulowanie kończy przebieg i wraca do konfiguracji z zachowaniem ustawień; ponowne uruchomienie zaczyna cały przebieg od przygotowania."
    - topic: "Wznowienie po pauzie"
      decision: "Standby lub ćwiczenie: pełny czas przygotowania, następnie to samo powtórzenie od początku z właściwymi sygnałami i nowym losowaniem, jeśli włączone. Ukończone powtórzenia zostają zachowane. Przygotowanie i odpoczynek: kontynuacja pozostałego czasu bez ponownego sygnału początku fazy."
    - topic: "Priorytety wymagań funkcjonalnych"
      decision: "Użytkownik potwierdził wszystkie 12 wymagań jako obowiązkowe w MVP."
    - topic: "Stały przedział losowego startu"
      decision: "Losowy start można włączyć lub wyłączyć; przedział 1–5 s jest stały i nie podlega konfiguracji. Losowanie co 0,01 s."
    - topic: "Początek odliczania losowego startu"
      decision: "Losowe oczekiwanie 1–5 s zaczyna się dopiero po zakończeniu drugiego krótkiego dźwięku Standby; czas odtwarzania obu dźwięków nie wlicza się do opóźnienia. Ta kolejność obowiązuje również przy wznowieniu powtórzenia."
    - topic: "Odsłuch sygnałów"
      decision: "Przygotowanie nie ma dźwięku. Przy ustawieniach ćwiczenia, odpoczynku i opcji Standby dostępny jest przycisk odsłuchu właściwego sygnału z informacją o jego znaczeniu."
    - topic: "Rozpoznawanie i usuwanie konfiguracji"
      decision: "Użytkownik nadaje nazwę przy zapisie; lista pokazuje nazwę i parametry; usunięcie wymaga potwierdzenia z nazwą konfiguracji."
    - topic: "Jednozdaniowa reguła biznesowa"
      decision: "Timer realizuje ustawione fazy i powtórzenia, a przy włączonym losowym starcie każde ćwiczenie poprzedza niezależnie losowanym oczekiwaniem 1–5 s, ukrywając przed użytkownikiem moment sygnału startu."
    - topic: "Przejście aplikacji w tło i blokada ekranu"
      decision: "Przejście do innej aplikacji lub zablokowanie ekranu powoduje pauzę; po powrocie wymagane jest ręczne wznowienie według ustalonych reguł."
    - topic: "Środowisko weryfikacji"
      decision: "Testy odbiorowe obejmują przynajmniej jedną powszechnie używaną przeglądarkę na komputerze i przynajmniej jedną na telefonie."
    - topic: "Początkowa skala użytkowników"
      decision: "Autor projektu i najwyżej kilka osób."
    - topic: "Wpływ skali na reguły timera"
      decision: "Reguły timera pozostają takie same niezależnie od liczby użytkowników."
    - topic: "Terminy kalendarzowe"
      decision: "Twardy termin: 10 stycznia 2027. Cel preferowany: 4 listopada 2026; cel zapasowy w razie problemów: 6 grudnia 2026. Plan nakładu pracy pozostaje równy 2 tygodniom po 10–15 godzin tygodniowo."
    - topic: "Odświeżenie strony"
      decision: "Dla gościa dane nie są zachowywane. Zalogowany użytkownik wraca na stronę startową z listą zapisanych konfiguracji; aktywny przebieg nie jest wznawiany po odświeżeniu."
    - topic: "Zapobieganie wygaszaniu"
      decision: "Podczas uruchomionego przebiegu ekran ma pozostawać włączony. Ręczna blokada ekranu nadal powoduje pauzę."
    - topic: "Limity konfiguracji"
      decision: "Powtórzenia: 1–100. Przygotowanie: 0–600 s; ćwiczenie i odpoczynek: 1–600 s. Czasy ustawiane w pełnych sekundach. Losowy start pozostaje w stałym przedziale 1–5 s co 0,01 s. Przygotowanie 0 s oznacza pominięcie tej fazy."
    - topic: "Zgodność i responsywność"
      decision: "Aplikacja działa w aktualnie wspieranych, powszechnie używanych przeglądarkach na komputerach i telefonach; responsywny interfejs dostosowuje się do ekranu urządzenia, na którym jest uruchomiona."
    - topic: "Podgląd następnej fazy"
      decision: "Podgląd pokazuje nazwę i pełny czas następnej fazy; przed Standby wyświetla Następnie: Standby, bez czasu."
    - topic: "Zapis kolorów faz"
      decision: "Kolory przygotowania, Standby, ćwiczenia i odpoczynku są zapisywane osobno w każdej nazwanej konfiguracji timera."
    - topic: "Paleta i domyślne kolory faz"
      decision: "Dziewięć kolorów: jasny szary, miętowy, błękitny, pomarańczowy, żółty, fioletowy, czerwony, zielony i różowy. Domyślnie: przygotowanie — żółty; Standby — pomarańczowy; ćwiczenie — błękitny; odpoczynek — czerwony."
  frs_drafted: 14
  quality_check_status: accepted
---

## Seed idea

Źródło: `idea-notes.md`. Plik zawiera opis pomysłu dostarczony przez użytkownika i pozostaje niezmieniony.

## Vision & Problem Statement

Autor projektu podczas ćwiczeń strzeleckich na sucho korzysta z timera HIIT, który obsługuje czas przygotowania, ćwiczenia, odpoczynku i liczbę powtórzeń. Brakuje w nim losowego opóźnienia startu z zadanego przedziału. Przewidywalny czas pozwala przygotować reakcję z wyprzedzeniem zamiast reagować na sygnał, co ogranicza przydatność obecnego timera w tym zastosowaniu.

DryFire Drill Timer ma zachować potrzebny przebieg faz i powtórzeń oraz umożliwić nieprzewidywalny start. Użytkownik chce symulować opisany przez siebie scenariusz zawodów IPSC: po potwierdzeniu gotowości i komendzie „standby” sygnał startu pojawia się po losowym opóźnieniu od 1 do 5 sekund. Jest to opis motywacji użytkownika, a nie deklaracja zgodności aplikacji z regulaminem zawodów. Reguły timera pozostają takie same niezależnie od liczby użytkowników, również przy stukrotnym wzroście skali.

## User & Persona

Pierwszym użytkownikiem jest autor projektu, ćwiczący strzelanie na sucho. Sięga po timer do prowadzenia sekwencji przygotowania, ćwiczenia i odpoczynku przez zadaną liczbę powtórzeń. Potrzebuje reagować na nieprzewidywalny sygnał startu.

## Success Criteria

### Primary

- Użytkownik bez logowania ustawia czasy przygotowania, ćwiczenia i odpoczynku oraz liczbę powtórzeń i opcjonalnie włącza losowy start o stałym przedziale 1–5 s, a następnie uruchamia pełny przebieg. Nieprzerwany przebieg obejmuje jednorazowe przygotowanie i zadaną liczbę cykli: opcjonalne losowe oczekiwanie, ćwiczenie, odpoczynek, włącznie z odpoczynkiem po ostatnim ćwiczeniu.
- Przy włączonym losowym starcie każde powtórzenie otrzymuje osobno losowane opóźnienie z przedziału 1–5 s co 0,01 s. Podczas oczekiwania bieżąca faza pokazuje napis „Standby” bez odliczania; podgląd wskazuje kolejne ćwiczenie i jego pełny czas. Dla pozostałych faz tylko główna sekcja odlicza pozostały czas, a sekcja aktualnej fazy pokazuje jej pełny skonfigurowany czas. Losowe oczekiwanie rozpoczyna się dopiero po zakończeniu obu krótkich dźwięków Standby w innej tonacji niż start ćwiczenia; czas ich odtwarzania nie wlicza się do opóźnienia 1–5 s. Początek ćwiczenia sygnalizuje jeden długi dźwięk, a początek odpoczynku jeden krótki dźwięk.

### Secondary

- Użytkownik może wygodnie skonfigurować i uruchomić timer na telefonie.

### Guardrails

- Konfiguracje konta są dostępne wyłącznie właścicielowi.
- Podczas „Standby” interfejs nie ujawnia pozostałego czasu ani momentu startu ćwiczenia.

## User Stories

### US-01: Użytkownik wykonuje pełny przebieg z losowym startem

- **Given** niezalogowany użytkownik ustawił przygotowanie 5 s, ćwiczenie 4 s, odpoczynek 2 s, 3 powtórzenia i włączył losowy start o stałym przedziale 1–5 s.
- **When** uruchamia timer i pozwala mu zakończyć przebieg bez przerw.
- **Then** po 5 s przygotowania timer wykonuje 3 cykle: niezależnie losowane „Standby”, 4 s ćwiczenia i 2 s odpoczynku. Odtwarza ustalone sygnały, ukrywa czas „Standby” i kończy przebieg po ostatnim odpoczynku.

#### Acceptance Criteria

- Przygotowanie występuje raz, przed pierwszym cyklem nieprzerwanego przebiegu.
- Każdy z trzech cykli otrzymuje osobno losowane opóźnienie z przedziału 1–5 s, co 0,01 s.
- Odliczanie wylosowanego opóźnienia zaczyna się dopiero po zakończeniu drugiego krótkiego dźwięku Standby; czas odtwarzania obu dźwięków nie wlicza się do opóźnienia. Po upływie całego wylosowanego czasu rozpoczyna się sygnał startu ćwiczenia.
- W czasie losowego oczekiwania bieżąca faza pokazuje napis „Standby” bez odliczania, wraz z podglądem następnego ćwiczenia i jego pełnego czasu; dla pozostałych faz tylko główna sekcja odlicza pozostały czas, a sekcja aktualnej fazy pokazuje jej pełny skonfigurowany czas.
- Początek Standby sygnalizują dwa krótkie dźwięki w innej tonacji niż start ćwiczenia, początek ćwiczenia jeden długi dźwięk, a początek odpoczynku jeden krótki dźwięk.
- Czas ćwiczenia wynosi 4 s niezależnie od długości poprzedzającego oczekiwania.
- Przebieg kończy się po odpoczynku trzeciego cyklu.

### US-02: Użytkownik obserwuje timer w trzech sekcjach

- **Given** użytkownik uruchomił timer z czasem ćwiczenia 4 s i odpoczynku 2 s.
- **When** trwa ćwiczenie.
- **Then** widzi trzy sekcje: główną z odliczaniem pozostałego czasu ćwiczenia, sekcję aktualnej fazy z nazwą ćwiczenia i stałym skonfigurowanym czasem 4 s oraz sekcję następnej fazy „Następnie: odpoczynek — 2 s”.

#### Acceptance Criteria

- Podgląd pokazuje nazwę i pełny skonfigurowany czas następnej fazy, a nie odliczanie czasu do jej rozpoczęcia.
- Odliczanie odbywa się wyłącznie w głównej sekcji. Sekcja aktualnej fazy pokazuje pełny skonfigurowany czas, który nie zmienia się w trakcie fazy; podczas Standby obie sekcje pokazują napis „Standby” bez czasu.
- Główna sekcja oraz sekcja aktualnej fazy mają tło w kolorze aktualnej fazy. Sekcja następnej fazy ma tło w kolorze następnej fazy.
- Czcionka odliczania lub napisu „Standby” w głównej sekcji jest wyraźnie większa niż czcionka w dwóch pozostałych sekcjach.
- W pionowym widoku telefonu sekcje są ułożone kolejno: główne odliczanie u góry, opis aktualnej fazy pośrodku i wyróżniony obszar następnej fazy poniżej, zgodnie z dostarczonymi grafikami referencyjnymi.
- Przykład: dla przygotowania ustawionego na 5 s główne odliczanie może pokazywać 2 s, podczas gdy sekcja aktualnej fazy nadal pokazuje 5 s, a sekcja następnego ćwiczenia jego skonfigurowane 4 s.
- Przy przejściu do kolejnej fazy treść i kolory wszystkich trzech sekcji aktualizują się zgodnie z przebiegiem timera.
- Podgląd aktualizuje się przy zmianie fazy i uwzględnia wyłączenie Standby oraz pominięcie przygotowania ustawionego na 0 s.
- Podczas Standby podgląd pokazuje następne ćwiczenie i jego pełny czas, bez ujawniania pozostałego czasu Standby.
- Gdy następna faza to Standby, podgląd pokazuje „Następnie: Standby”, bez czasu.
- Podczas ostatniego odpoczynku podgląd informuje o zakończeniu przebiegu zamiast zapowiadać kolejną fazę z czasem.

### US-03: Użytkownik wybiera kolory faz

- **Given** użytkownik konfiguruje timer.
- **When** wybiera kolorowe kafelki z predefiniowanej palety osobno dla przygotowania, Standby, ćwiczenia i odpoczynku, a następnie uruchamia przebieg.
- **Then** główna sekcja i sekcja aktualnej fazy mają wybrany kolor aktualnej fazy, a sekcja następnej fazy ma kolor wybrany dla następnej fazy.

#### Acceptance Criteria

- Każda z czterech faz ma niezależny wybór koloru.
- Wybór odbywa się przez kolorowe kafelki z predefiniowanej listy.
- Początkowa paleta obejmuje dziewięć kolorów: jasny szary, miętowy, błękitny, pomarańczowy, żółty, fioletowy, czerwony, zielony i różowy. Odcienie są łagodne, inspirowane dostarczonym zdjęciem.
- Domyślne kolory faz: przygotowanie — żółty; Standby — pomarańczowy; ćwiczenie — błękitny; odpoczynek — czerwony. Użytkownik może zmienić każdy z nich na inny kolor z palety.
- Czas jest wyświetlany czarną czcionką, dobrze kontrastującą z każdym kolorem tła dostępnym w palecie.
- Kolory w palecie są wyraźnie rozróżnialne między sobą. Domyślne kolory czterech faz są różne i dobrane tak, aby zmiana tła jednoznacznie sygnalizowała przejście do kolejnej fazy.
- Wybrany kafelek jest jednoznacznie oznaczony.
- Nazwa fazy, czas i podgląd następnej fazy pozostają czytelne dla każdego dostępnego koloru.
- Wybór kolorów jest dostępny również bez logowania, tak jak pozostała konfiguracja timera.
- Zalogowany użytkownik zapisuje kolory razem z nazwaną konfiguracją; jej ponowne otwarcie i uruchomienie odtwarza zapisane kolory.
- Edycja kolorów jednej zapisanej konfiguracji nie zmienia kolorów innych konfiguracji.

## Functional Requirements

Pierwotne wymagania FR-001–FR-012 zostały potwierdzone jako must-have i przeszły rundę wyzwania Sokratesowego. Na prośbę użytkownika dodano FR-013–FR-014 do zakresu MVP; szczegóły wymagające rozstrzygnięcia zapisano w Open Questions.

### Konfiguracja i przebieg timera

- FR-001: Użytkownik może bez logowania ustawić czas przygotowania 0–600 s, ćwiczenia i odpoczynku po 1–600 s, w pełnych sekundach, oraz liczbę powtórzeń 1–100; przygotowanie 0 s jest pomijane. Priority: must-have
  > Socrates: Kontrargument: pełne sekundy mogą być zbyt mało precyzyjne dla krótkich ćwiczeń. Decyzja użytkownika: bez zmian.
- FR-002: Użytkownik może włączyć lub wyłączyć losowy start o stałym przedziale 1–5 s, z osobnym losowaniem co 0,01 s przed każdym powtórzeniem; odliczanie wylosowanego czasu zaczyna się dopiero po zakończeniu drugiego krótkiego dźwięku Standby, a czas odtwarzania sygnałów nie wlicza się do opóźnienia 1–5 s. Priority: must-have
  > Socrates: Kontrargument: stałe 1–5 s wystarczy, a dowolny przedział zwiększa liczbę ustawień. Decyzja użytkownika: stałe 1–5 s z możliwością włączenia lub wyłączenia losowego startu.
- FR-003: Użytkownik może uruchomić pełny przebieg z jednorazowym przygotowaniem i zadaną liczbą cykli obejmujących opcjonalne Standby, ćwiczenie i odpoczynek, także po ostatnim ćwiczeniu. Priority: must-have
  > Socrates: Kontrargument: użytkownik może oczekiwać zakończenia od razu po ostatnim ćwiczeniu. Decyzja użytkownika: bez zmian, ostatni odpoczynek pozostaje.
- FR-004: Użytkownik może rozpoznać początek Standby po dwóch krótkich dźwiękach w innej tonacji niż start ćwiczenia, początek ćwiczenia po jednym długim dźwięku i początek odpoczynku po jednym krótkim dźwięku oraz przy ustawieniach ćwiczenia, odpoczynku i opcji Standby użyć przycisku odsłuchu sygnału z informacją o jego znaczeniu; przygotowanie nie ma sygnału dźwiękowego. Priority: must-have
  > Socrates: Kontrargument: bez wcześniejszego odsłuchu znaczenie sygnałów może być niejasne. Decyzja użytkownika: przyciski odsłuchu z informacją o znaczeniu przy ćwiczeniu, odpoczynku i opcji Standby; przygotowanie pozostaje bez dźwięku i bez przycisku odsłuchu.
- FR-005: Użytkownik może w głównej sekcji obserwować pozostały czas przygotowania, ćwiczenia i odpoczynku, natomiast podczas losowego oczekiwania w obszarze bieżącej fazy widzi napis „Standby” bez odliczania; podgląd następnej fazy opisuje FR-013. Priority: must-have
  > Socrates: Kontrargument: odliczanie podczas ćwiczenia może odciągać od niego uwagę. Decyzja użytkownika: bez zmian.

### Sterowanie timerem

- FR-006: Użytkownik może zatrzymać przebieg i go wznowić; przejście do innej aplikacji lub zablokowanie ekranu również powoduje pauzę wymagającą ręcznego wznowienia; po pauzie w Standby lub ćwiczeniu odliczany jest pełny czas przygotowania, po czym to samo powtórzenie zaczyna się od początku z właściwymi sygnałami i nowym losowaniem, jeśli włączone, z zachowaniem ukończonych powtórzeń; przygotowanie i odpoczynek kontynuują pozostały czas bez ponawiania sygnału początku fazy. Priority: must-have
  > Socrates: Kontrargument: wznowienie ćwiczenia bez przygotowania może zaskoczyć użytkownika. Decyzja użytkownika: pełne przygotowanie i rozpoczęcie tego samego powtórzenia od początku, wraz z dźwiękami i nowym losowaniem, jeśli włączone; nie kontynuacja pozostałego czasu ćwiczenia.
- FR-007: Użytkownik może anulować przebieg i wrócić do konfiguracji z zachowaniem ustawień. Priority: must-have
  > Socrates: Kontrargument: przypadkowe naciśnięcie może zakończyć przebieg wbrew intencji użytkownika. Decyzja użytkownika: bez zmian.
- FR-008: Użytkownik może ponownie uruchomić cały przebieg od przygotowania. Priority: must-have
  > Socrates: Kontrargument: przypadkowy restart może utracić postęp bieżącego przebiegu. Decyzja użytkownika: bez zmian.

### Konto i zapisane konfiguracje

- FR-009: Użytkownik może uzyskać dostęp do konta przez magic link; pierwsze poprawne użycie linku tworzy konto dla nowego adresu, a kolejne loguje. Priority: must-have
  > Socrates: Kontrargument: otwieranie poczty może utrudnić dostęp do konfiguracji przed ćwiczeniem. Decyzja użytkownika: bez zmian.
- FR-010: Zalogowany użytkownik może zapisać własną konfigurację timera wraz z kolorami wszystkich faz, nadając jej nazwę. Priority: must-have
  > Socrates: Kontrargument: bez rozróżnialnych nazw trudno rozpoznać zapisaną konfigurację. Decyzja użytkownika: nadawanie nazwy przy zapisie.
- FR-011: Zalogowany użytkownik może przeglądać listę własnych konfiguracji z nazwami i parametrami oraz ich szczegóły i uruchomić wybraną konfigurację; lista jest stroną startową, na którą trafia po odświeżeniu strony. Priority: must-have
  > Socrates: Kontrargument: wybór bez widocznych parametrów może prowadzić do uruchomienia niewłaściwego ćwiczenia. Decyzja użytkownika: nazwa i parametry widoczne na liście przed uruchomieniem.
- FR-012: Zalogowany użytkownik może edytować i usuwać własne konfiguracje, przy czym usunięcie wymaga potwierdzenia z nazwą konfiguracji. Priority: must-have
  > Socrates: Kontrargument: przypadkowo usuniętą konfigurację trzeba odtworzyć z pamięci. Decyzja użytkownika: potwierdzenie usunięcia z nazwą konfiguracji.

### Podgląd i kolory faz

- FR-013: Użytkownik może obserwować przebieg timera w trzech sekcjach: głównej z odliczaniem pozostałego czasu aktualnej fazy, aktualnej fazy z jej nazwą i stałym pełnym skonfigurowanym czasem (bez odliczania) oraz następnej fazy z jej nazwą i pełnym skonfigurowanym czasem; dla Standby zamiast czasu widoczny jest napis „Standby”. Główna sekcja i sekcja aktualnej fazy mają kolor aktualnej fazy, a sekcja następnej fazy jej własny kolor. Czcionka w głównej sekcji jest wyraźnie większa niż w pozostałych dwóch. Widok uwzględnia pomijane fazy i koniec przebiegu. Priority: must-have
- FR-014: Użytkownik może bez logowania wybrać osobno kolor tła przygotowania, Standby, ćwiczenia i odpoczynku z predefiniowanej listy prezentowanej jako kolorowe kafelki; podczas przebiegu tło odpowiada wyborowi dla aktywnej fazy, a kolory są zapisywane i odtwarzane osobno dla każdej nazwanej konfiguracji timera. Priority: must-have

## Non-Functional Requirements

- Nazwa bieżącej fazy, jej czas oraz podgląd następnej fazy pozostają czytelne na każdym tle z predefiniowanej palety; kolor nie jest jedynym sposobem rozpoznania fazy.
- Kolory tła mają łagodne odcienie zapewniające dobrą czytelność czasu wyświetlanego czarną czcionką.
- Paleta zapewnia także wyraźne różnice między kolorami, pozwalające łatwo odróżniać kolejne fazy; łagodność odcieni nie może zacierać tych różnic.

- Podczas aktywnego przebiegu bezwzględny błąd momentu emisji sygnału dźwiękowego względem zaplanowanego momentu nie przekracza 0,2 s. Krok losowania 0,01 s jest odrębną właściwością.
- Aplikacja webowa umożliwia konfigurację, pełny przebieg timera i uzgodnioną obsługę pauzy w aktualnie wspieranych, powszechnie używanych przeglądarkach na komputerach i telefonach.
- Testy odbiorowe obejmują przynajmniej jedną powszechnie używaną przeglądarkę na komputerze i przynajmniej jedną na telefonie, weryfikując konfigurację, przebieg timera, sterowanie oraz responsywność interfejsu.
- Interfejs jest responsywny i dostosowuje się do ekranów telefonów i komputerów, bez konieczności przewijania w poziomie. Na telefonie sterowanie jest wygodne w użyciu i odporne na przypadkowe dotknięcia. Podczas działania timera faza i odliczanie są czytelne bez powiększania, a sterowanie jest łatwo dostępne.
- Podczas uruchomionego przebiegu ekran nie wygasza się automatycznie. Ręczna blokada ekranu powoduje pauzę według ustalonych reguł.
- Konfiguracje zapisane na koncie są dostępne wyłącznie właścicielowi.
- W trakcie Standby użytkownik nie otrzymuje informacji ujawniającej pozostały czas ani zaplanowany moment startu.

## Business Logic

Timer realizuje ustawione fazy i powtórzenia, a przy włączonym losowym starcie każde ćwiczenie poprzedza niezależnie losowanym oczekiwaniem 1–5 s, ukrywając przed użytkownikiem moment sygnału startu.

Wejściem są czas przygotowania 0–600 s, czasy ćwiczenia i odpoczynku po 1–600 s (wszystkie w pełnych sekundach), liczba powtórzeń 1–100 oraz wybór włączenia lub wyłączenia losowego startu. Przedział losowania 1–5 s jest stały; wartości losowane są co 0,01 s. Nieprzerwany przebieg zaczyna się przygotowaniem, po którym następuje zadana liczba cykli obejmujących opcjonalne Standby, pełny czas ćwiczenia i odpoczynek, także po ostatnim ćwiczeniu. Przygotowanie 0 s jest pomijane, również przy wznowieniu i restarcie. Losowe oczekiwanie nie skraca ćwiczenia.

Użytkownik rozpoznaje fazy po sygnałach: Standby — dwa krótkie dźwięki w innej tonacji niż start ćwiczenia, ćwiczenie — jeden długi dźwięk, odpoczynek — jeden krótki dźwięk. Odliczanie losowego oczekiwania 1–5 s rozpoczyna się dopiero po zakończeniu drugiego krótkiego dźwięku Standby. Czas odtwarzania sygnałów nie wlicza się do tego opóźnienia; po jego upływie rozpoczyna się długi sygnał startu ćwiczenia. Przygotowanie nie ma dźwięku. Podczas Standby główna sekcja i sekcja aktualnej fazy pokazują ten napis bez czasu. Dla pozostałych faz odliczanie odbywa się wyłącznie w głównej sekcji, a sekcja aktualnej fazy pokazuje stały pełny skonfigurowany czas. Dodatkowy podgląd pokazuje nazwę i pełny czas następnej fazy bez ujawniania wylosowanego opóźnienia Standby; podczas ostatniego odpoczynku zapowiada zakończenie przebiegu. Tło aktywnej fazy ma kolor wybrany dla niej z predefiniowanej palety. Przed startem użytkownik może odsłuchać sygnały przy odpowiednich ustawieniach wraz z informacją o ich znaczeniu.

Wznowienie pauzy w Standby lub ćwiczeniu dodaje pełne przygotowanie i rozpoczyna to samo powtórzenie od początku, zachowując ukończone powtórzenia; przy włączonym losowym starcie opóźnienie losowane jest ponownie i odliczane dopiero po zakończeniu obu ponownie odtworzonych krótkich dźwięków Standby. Wznowienie przygotowania lub odpoczynku kontynuuje pozostały czas bez ponownego sygnału. Przejście do innej aplikacji lub blokada ekranu powoduje pauzę wymagającą ręcznego wznowienia po powrocie według tych samych reguł. Anulowanie wraca do konfiguracji z zachowaniem ustawień, a ponowne uruchomienie rozpoczyna cały przebieg od przygotowania.

## Access Control

Timer jest dostępny bez logowania, bez możliwości zapisywania konfiguracji na koncie. Konto jest potrzebne do zapisywania własnych konfiguracji.

Logowanie odbywa się przez magic link — jednorazowy link wysyłany na adres email użytkownika. Pierwsze poprawne użycie linku dla nowego adresu tworzy konto, a kolejne loguje do istniejącego konta. Nie ma osobnego formularza rejestracji.

Jeden rodzaj konta. Każdy zalogowany użytkownik zarządza wyłącznie własnymi konfiguracjami.

Po odświeżeniu strony dane niezalogowanego użytkownika nie są zachowywane. Zalogowany użytkownik trafia na stronę startową — listę zapisanych konfiguracji. Odświeżenie nie wznawia aktywnego przebiegu.

## Non-Goals

### Permanent Non-Goals

Trwałe granice produktu: poniższe funkcje nie będą implementowane ani w MVP, ani w przyszłych wersjach aplikacji.

- Udostępnianie konfiguracji, funkcje społecznościowe i rozbudowane role — produkt służy samodzielnej pracy z własnymi konfiguracjami.
- Integracje z urządzeniami zewnętrznymi i sprzętem treningowym — produkt pozostaje samodzielnym timerem bez integracji sprzętowych.

### MVP Non-Goals

Wyłączenia dotyczące pierwszej wersji; nie stanowią zobowiązania do implementacji w przyszłości.

- Historia treningów i statystyki — MVP prowadzi bieżące ćwiczenie, bez zapisywania zakończonych sesji (daty, użytej konfiguracji, ukończonych powtórzeń, czasu ćwiczeń) i zestawień aktywności między sesjami.
- Gotowa biblioteka drillów — użytkownik sam konfiguruje ćwiczenia.
- Tryb offline i pełna aplikacja PWA — MVP nie zapewnia działania offline ani pełnego zakresu PWA.
- Powiadomienia poza aktywną aplikacją — przejście w tło powoduje pauzę z ręcznym wznowieniem po powrocie.

## Open Questions

1. **Jakie dokładne odcienie zastosować dla dziewięciu wybranych kolorów?** — Do dobrania podczas projektowania interfejsu, przed implementacją FR-014, z zachowaniem łagodności, wyraźnego rozróżnienia barw i kontrastu z czarną czcionką. Zestaw kolorów i ich domyślne przypisanie do faz są ustalone.

Konkretne wersje środowiska odbioru zostaną odnotowane przy testach zgodnie z wymaganiem zgodności.

## MVP flow

1. Użytkownik otwiera aplikację i ustawia czas przygotowania 0–600 s, ćwiczenia i odpoczynku po 1–600 s oraz liczbę powtórzeń 1–100.
2. Opcjonalnie włącza losowy start o stałym przedziale 1–5 s, bez edycji granic. Pozostałe ustawienia czasu są w pełnych sekundach, np. 0:02, 0:05, 0:10. Przy ustawieniach ćwiczenia, odpoczynku i opcji Standby może odsłuchać właściwy sygnał wraz z informacją o jego znaczeniu.
3. Użytkownik uruchamia timer. Czas przygotowania jest odliczany raz na początku nieprzerwanego przebiegu, bez sygnału dźwiękowego; przy 0 s faza jest pomijana.
4. Jeśli włączono losowy start, przed każdym ćwiczeniem losowane jest nowe opóźnienie 1–5 s co 0,01 s. Najpierw odtwarzane są dwa krótkie sygnały Standby. Dopiero po zakończeniu drugiego zaczyna się odliczanie całego wylosowanego opóźnienia 1–5 s; czas odtwarzania sygnałów nie wlicza się do opóźnienia. Podczas sygnałów i oczekiwania obszar bieżącej fazy pokazuje napis „Standby” bez odliczania; podgląd następnej fazy pokazuje ćwiczenie i jego pełny czas. Opóźnienie poprzedza czas ćwiczenia i nie skraca go.
5. Jeden długi sygnał rozpoczyna odliczanie pełnego czasu ćwiczenia.
6. Jeden krótki sygnał rozpoczyna odliczanie odpoczynku.
7. Kroki 4–6 powtarzają się zadaną liczbę razy, a przebieg kończy się po ostatnim odpoczynku. Przy wyłączonym losowym starcie krok 4 jest pomijany.

Przykład podany przez użytkownika: 3 powtórzenia, przygotowanie 5 s, ćwiczenie 4 s, losowe opóźnienie 1–5 s, odpoczynek 2 s. Dokładne wylosowane wartości nie są z góry narzucone.

### Sterowanie przebiegiem

- Zatrzymanie oznacza pauzę z możliwością wznowienia.
- Przejście do innej aplikacji lub zablokowanie ekranu powoduje pauzę. Powrót do aplikacji nie wznawia automatycznie przebiegu; użytkownik wznawia go ręcznie według reguł właściwych dla przerwanej fazy.
- Wznowienie po pauzie w Standby lub ćwiczeniu odlicza pełny skonfigurowany czas przygotowania, a następnie rozpoczyna to samo powtórzenie od początku. Przy włączonym losowym starcie najpierw odtwarzane są oba krótkie dźwięki Standby, a dopiero po zakończeniu drugiego rozpoczyna się odliczanie nowego oczekiwania losowanego z 1–5 s, po którym długi sygnał rozpoczyna pełny czas ćwiczenia. Przy wyłączonym losowym starcie po przygotowaniu długi sygnał rozpoczyna od razu pełny czas ćwiczenia. Ukończone powtórzenia pozostają zachowane. Dodatkowe przygotowanie dotyczy takiego wznowienia, nie wszystkich kolejnych powtórzeń.
- Wznowienie podczas przygotowania lub odpoczynku kontynuuje pozostały czas bez ponownego sygnału początku fazy.
- Anulowanie kończy przebieg i wraca do konfiguracji, zachowując ustawienia.
- Ponowne uruchomienie rozpoczyna cały przebieg od przygotowania.
- Odświeżenie strony nie zachowuje danych gościa; zalogowanego użytkownika kieruje na listę zapisanych konfiguracji. Aktywny przebieg nie jest wznawiany po odświeżeniu.
- Podczas uruchomionego przebiegu ekran ma pozostawać włączony bez automatycznego wygaszania.
- Przygotowanie ustawione na 0 s jest pomijane także przy wznowieniu lub ponownym uruchomieniu przebiegu.

## Timeline budget

Użytkownik zakłada 2 tygodnie na całe MVP przy zaangażowaniu 10–15 godzin tygodniowo, wyłącznie po godzinach pracy.

Twardy, nieprzekraczalny termin zakończenia: 10 stycznia 2027. Wcześniejsze cele kalendarzowe: 4 listopada 2026 — preferowany termin, jeśli uda się go osiągnąć; 6 grudnia 2026 — termin zapasowy dający dodatkowy czas w razie problemów. Cele kalendarzowe nie zmieniają dwutygodniowego planu pracy nad MVP.

## Forward: technical-roadmap

Odniesienia wizualne układu trzech sekcji: [przed startem](resources/start_screen_before_start.PNG) i [po starcie](resources/start_screen_after_start.PNG). Grafiki ilustrują hierarchię wielkości tekstu, pionowy układ sekcji, tło aktualnej i następnej fazy oraz stały czas w opisie aktualnej fazy przy zmieniającym się głównym odliczaniu. Pozostałe widoczne elementy, takie jak liczniki ELAPSED / INTERVAL / REMAINING czy ikona blokady, nie stanowią dodatkowych wymagań wynikających z tych referencji.

Odniesienie wizualne palety: [zdjęcie użytkownika](resources/color_palete.PNG). Traktować jako wstępną inspirację; obowiązuje lista dziewięciu kolorów i domyślne przypisania zapisane w US-03. Podczas projektowania interfejsu dobrać dokładne odcienie: łagodne, wyraźnie rozróżnialne między sobą i dobrze kontrastujące z czarną czcionką czasu.

Wymagania procesu dostarczone w `idea-notes.md`, do przejęcia w planowaniu technicznym:

- Pierwszy działający kamień milowy: pełny timer z fazami, powtórzeniami i losowym startem przed dodaniem zapisywania konfiguracji.
- Co najmniej jeden test pełnego przepływu z perspektywy użytkownika; w notatkach dopuszczono test automatyczny lub inny powtarzalny test akceptacyjny.
- Wersja wdrożona pod adresem umożliwiającym demonstrację oraz dokumentacja kontekstowa opisująca decyzje, ograniczenia i sposób weryfikacji wyników agentów.
- Cel autora: implementacja wykonywana przez agentów LLM; autor definiuje zadania, weryfikuje rezultaty, uruchamia testy i kieruje poprawkami bez ręcznego pisania kodu.
- Do rozstrzygnięcia po wyborze technologii: mechanizm wdrożenia i przechowywania danych oraz zestaw dokumentów i dowodów procesu pracy agentów.

## Quality cross-check

| Kryterium | Wynik |
| --- | --- |
| Access Control | present — magic link, dostęp gościa, własność konfiguracji |
| Business Logic | present — zatwierdzona jednozdaniowa reguła i opis przebiegu |
| Project artifacts | present — shape-notes.md i checkpoint |
| Timeline-cost acknowledgment | present — MVP 2 tygodnie, dodatkowe potwierdzenie dłuższego terminu nie jest wymagane |
| Non-Goals | present — jawne wyłączenia zakresu |
| Preserved behavior | n/a — greenfield |

Ponowna kontrola po dodaniu FR-013–FR-014 potwierdziła zgodność struktury PRD ze schematem oraz brak wycieków konkretnych technologii. Ustalono paletę dziewięciu kolorów i domyślne kolory faz; w Open Questions pozostaje nieblokujący dobór dokładnych odcieni podczas projektowania interfejsu. Użytkownik zaakceptował oba dokumenty.

## Session status

Aktualizacja 2026-09-18: dodano FR-013–FR-014 oraz US-02–US-03 dotyczące podglądu następnej fazy i kolorów tła. Ponowna kontrola rozszerzonego zakresu została zakończona; dokumenty zaakceptowano.

Kształtowanie zakończone. Fazy 1–7 ukończone; 12 wymagań must-have, US-01, reguła biznesowa, wymagania jakościowe i granice produktu zaakceptowane. Kontrola jakości: accepted. Notatki gotowe do /10x-prd. Dla greenfield kolejne kroki po PRD to wybór technologii i bootstrap projektu.
