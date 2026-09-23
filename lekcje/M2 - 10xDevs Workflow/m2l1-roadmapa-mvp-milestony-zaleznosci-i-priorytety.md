---
title: "Roadmapa MVP: milestony, zależności i priorytety"
course: "10xdevs-4"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-09-23"
format: "markdown"
---

![Obraz 1](https://images.przeprogramowani.pl/cms/04fd5d8a-b0df-4baf-8e90-f8dba7293def/4cce7dd0a3b6d8fa0fc255a67bf48e4ac535ca9b7ee6171ce9de67641bc66065.jpg)

Sprint zero za nami - gratulacje! Pomysł przegryziony przez **/10x-shape** i **/10x-prd**, stack wybrany, repo przygotowane, reguły dla agenta na swoim miejscu, aplikacja na produkcji.

Naturalna pokusa jest jedna: skopiować **prd.md** do okna agenta i napisać „zbuduj mi z tego MVP”. Tydzień pracy po godzinach, prezentacja na piątek, lecimy.

A potem... no cóż. Agent zabiera się do pracy. Napędzany wybranym LLM-em, ze wszystkimi cechami niedeterministycznych modeli, raz zacznie od endpointów, a innym razem od UI. Raz będzie pamiętał o dodaniu migracji do bazy, a raz o braku tabel dowiesz się w runtime. Czasem praca będzie przebiegać horyzontalnie (warstwa po warstwie), a czasem bardziej full-stackowo.

Coś tam wyprodukowaliśmy, tokeny spalone, a powtarzalnych efektów brak.

To bezpośredni rezultat architektury silnika, który napędza agenta. Agent dostał za szeroki cel, bez oczekiwanych kierunków pracy, bez priorytetów i bez wskazania, gdzie jest największe ryzyko. **Agent pracuje tobą.**

W module 2 zmieniamy ten układ. W tej lekcji wcielasz się w rolę Technical Project Managera: zamiast pytać „co teraz zakodować?”, wspólnie z agentem układasz sekwencję pracy, dbasz o wykonalną kolejność zadań i przekładasz to na backlog, do którego dostęp ma zarówno człowiek, jak i agent.

Plan przed kodem.

### Programista jako Technical Project Manager

Technical Project Manager to osoba, która łączy cel produktowy z technicznym wykonaniem. Decyduje, w jakiej kolejności idzie praca, gdzie czai się największe ryzyko, co blokuje start, kto ma czas na co i co świadomie wypada poza zakres. Wszystko po to, żeby na etapie właściwej realizacji „rzeczy się działy” jak najbardziej płynnie.

Agent przyspiesza pisanie kodu, ale jednocześnie pozwala dużo szybciej wyprodukować pozorny postęp - jeżeli sekwencja pracy jest zła, dostajesz rosnącą aplikację, w której nie widać, czy najważniejszy scenariusz dla odbiorcy tego projektu w ogóle działa.

![Obraz 2](https://images.przeprogramowani.pl/cms/04fd5d8a-b0df-4baf-8e90-f8dba7293def/e22a6b45aec4dd667aaa617cb73210cc00d0d96b1eb223b803fbc64082a3b45e.png)

Tutaj mogą pomóc kompetencje TPM-a, bo realnie wpływają na efektywną pracę z agentami. I w żadnym wypadku nie chodzi nam o organizowanie spotkań czy zbieranie statusów.

Od teraz zaczynamy więc patrzeć na projekt jako całość, a na każde zadanie jako na jego część. Chcemy poznać:

- **Cel** - co konkretnie chcemy mieć po pierwszym milestone'ie i dlaczego.

- **Sekwencja** - co idzie pierwsze, co drugie, co trafia na parking.

- **Ryzyko** - gdzie projekt może się wywalić i co najpierw redukuje to ryzyko.

- **Capacity i ownership** - kto (albo który agent) co robi, gdzie potrzebne są punkty synchronizacji, co da się robić równolegle.

Z tymi decyzjami delegowanie pracy agentom staje się bardziej przewidywalnym kontraktem. Agent dostaje nie tylko prompt „co zrobić”, ale też „to jest slice numer jeden z listy pięciu i tu są jego zależności”.

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1193145324" title="Odtwarzacz wideo Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>

### Skill /10x-roadmap w praktyce

Czas wygenerować **roadmap.md**.

Zacznijmy tak samo jak poprzednio - od pobrania paczki skilli dla tej lekcji:

```
npx @przeprogramowani/10x-cli@latest get m2l1
```

W paczce dostajesz nowość: **/10x-roadmap**, czyli skill, który otwiera milestone, audytuje repozytorium pod kątem tego, co już zostało zbootstrapowane (frontend, backend/API, data, auth, deploy, observability) i rozkłada milestone na pionowe slice'y z fundamentami. Prowadzi ten milestone aż do zamknięcia, a potem otwiera następny.

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1193146130" title="Odtwarzacz wideo Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>

Skill nie wybiera frameworków (od tego jest **tech-stack.md**), nie projektuje schematów bazy (od tego jest **/10x-plan**, który wprowadzimy w kolejnej lekcji), nie pisze planu implementacji jednego slice'a (od tego jest **/10x-plan \<change-id>**). Decyduje tylko, **co najpierw, w jakiej kolejności i co odblokowuje co**. Na tym etapie chcemy mieć wstępne wyobrażenie o tym, jak rozłożyć pracę nad projektem na kolejne zadania.

Zacznijmy od inicjalizacji procesu:

```
/10x-roadmap
```

### Terminologia i kody zadań

Prezentowany w tej lekcji skill do tworzenia roadmapy będzie oznaczał zadania, korzystając z dwóch prefiksów:

- **F-XX (foundations)** - zadania techniczne i wymagania niefunkcjonalne (np. przygotowanie bazy danych, integracja narzędzia do analityki produktowej)

- **S-XX (slice)** - full-stackowe slice'y (zadania) funkcjonalne, które razem składają się na wartość zaprojektowaną dla użytkownika końcowego (np. edycja konta, landing page z informacjami o produkcie).

Ponad nimi stoi trzecie pojęcie, którym skill posługuje się precyzyjnie:

- **M-NN (milestone)** - nazwany zestaw fundamentów i slice'ów, które razem potwierdzają osiągnięcie jednego rezultatu. Milestone nie ma daty ani czasu trwania. Zamyka się wtedy, gdy wszystkie jego zadania mają status **done**, a nie wtedy, gdy minie tydzień. W projekcie otwarty jest dokładnie jeden milestone naraz.

Od tego miejsca słowa „milestone” używamy wyłącznie w tym znaczeniu - jako kontenera na zadania, a nie jako synonimu pojedynczego slice'a.

Jest jeszcze jeden termin określający ogólny kierunek, w którym zmierza cały projekt, czyli **north-star** (i często wiązana z nim [North-Star Metric](https://mixpanel.com/blog/north-star-metric/)). To nadrzędny, wyróżniający nas spośród konkurencji element aplikacji, który może być na roadmapie MVP zdefiniowany jako jedno lub kilka zadań. O szczegółach poniżej.

### Roadmapa 10xCards: jeden konkret

Aktualna roadmapa 10xCards zaczyna się od dwóch zadań typu **foundations** i pięciu slice'ów funkcjonalnych. Z lotu ptaka wygląda ona następująco:

- **ID**: F-01 | **Change ID**: gate-product-routes | **Outcome**: Produktowe ścieżki są chronione logowaniem | **Prereq**: — | **Status**: ready

- **ID**: F-02 | **Change ID**: first-prod-deploy | **Outcome**: Pierwszy deployment produkcyjny jest gotowy | **Prereq**: — | **Status**: ready

- **ID**: S-01 | **Change ID**: first-gated-generation | **Outcome**: Wklejony tekst tworzy zapisane drafty kart | **Prereq**: F-01 | **Status**: proposed

- **ID**: S-02 | **Change ID**: atomic-save-to-deck | **Outcome**: Kandydaci są oceniani i atomowo zapisani | **Prereq**: S-01 | **Status**: proposed

- **ID**: S-03 | **Change ID**: deck-edit-delete | **Outcome**: Deck pozwala przeglądać, edytować i usuwać | **Prereq**: S-02 | **Status**: proposed

- **ID**: S-04 | **Change ID**: srs-review-session | **Outcome**: Pierwsza powtórka zapisuje ocenę karty | **Prereq**: S-02 | **Status**: blocked

- **ID**: S-05 | **Change ID**: account-deletion-with-retention | **Outcome**: Usunięcie konta ma 30-dniową retencję | **Prereq**: F-01 | **Status**: proposed

W tej roadmapie **north star** to S-04, czyli pierwsza ocena karty w sesji powtórki. Dopiero wtedy wiemy, że cały pomysł produktu zadziałał od początku do końca: użytkownik wkleił własny materiał, dostał propozycje od AI, zaakceptował wybrane karty, zapisał je do decka i użył ich w mechanizmie spaced repetition.

To dobrze pokazuje, że north star nie zawsze jest pierwszym slice'em w kolejce. S-01 i S-02 są konieczne, bo bez nich nie ma kart do powtarzania. S-04 jest jednak slice'em walidacyjnym - pierwszym momentem, w którym teza produktu naprawdę się domyka. Dlatego roadmapa umieszcza go tak wcześnie, jak pozwalają zależności, ale nie udaje, że da się zacząć od review, jeśli nie istnieje jeszcze zapisany deck.

F-01 jest małym fundamentem, a nie osobnym „projektem auth”. Szkielet logowania już istnieje w baseline, więc foundation ogranicza się do objęcia produktowych ścieżek ochroną i dopracowania landing page'a. F-02 idzie równolegle: produkcyjny deployment nie buduje funkcji widocznej dla użytkownika, ale odblokowuje weryfikację S-01 w realnych warunkach - dopiero na produkcji sprawdzisz prywatność i responsywność generowania kart.

Blokada na S-04 też jest konkretna. Roadmapa nie mówi „zbudujmy kiedyś SRS”. Mówi: zanim zaplanujesz sesję powtórki, wybierz bibliotekę SRS, bo ona narzuci strukturę **ReviewState**, skalę ocen i politykę „co dzieje się po edycji karty”. To jest dokładnie typ niewiadomej, który powinien wypłynąć na roadmapie, a nie dopiero w środku implementacji.

Roadmapa nie ma osobnego pola **Acceptance criteria**, ale daje materiał, z którego wyciągniesz je przy tworzeniu backlog itemu: **Outcome**, **PRD refs**, **Risk**, **Unknowns** i status. Dla S-02 takie kryteria można zapisać tak:

- Każdy kandydat wymaga jawnej akceptacji albo odrzucenia.

- **Save** działa atomowo: wszystkie zaakceptowane drafty trafiają do decka albo nie trafia żaden.

- Drafty **pending** i **rejected** nie wpadają do decka.

- Po zapisie użytkownik widzi podstawową listę zapisanych kart.

- Logika stanu **FlashcardDraft** jest testowana, bo to tutaj domyka się biznesowa reguła: karta zaczyna jako propozycja AI, ale trafia do decka dopiero po decyzji człowieka.

To są zdania, które warto wpisać do backlog itemu jako acceptance criteria i podać dalej jako kontekst dla agenta w **/10x-plan atomic-save-to-deck**.

> **Mała uwaga.** **main\_goal** w tej roadmapie to **speed**, a **top\_blocker** to **time**. Dlatego obserwowalność, preview environment per PR, własny algorytm SRS, import PDF/DOCX i ręczne tworzenie kart trafiają do **Parked**. Roadmapa nie jest pełną listą marzeń - jest decyzją, co dowozimy najpierw, żeby jak najszybciej sprawdzić tezę produktu.

### Vertical-first jako domyślna strategia

Roadmapa generowana przez skill opiera się na tzw. **vertical slices**. Każdy slice to jeden konkretny przepływ użytkownika, który przechodzi przez wszystkie warstwy aplikacji - UI, dane, logikę, integracje - i kończy się czymś, co użytkownik realnie widzi i może zweryfikować.

Alternatywą jest **horizontal slicing** - planowanie pracy warstwami. Najpierw cała baza, potem całe API, potem cały UI. Tak naturalnie myślą zespoły podzielone funkcyjnie (frontend, backend, data) i tak naturalnie układają się „fundamenty” w głowach programistów z większym doświadczeniem inżynierskim.

Z agentem AI domyślnie chcemy iść inaczej, z trzech powodów.

- **Weryfikowalność.** Pionowy slice kończy się czymś, co da się kliknąć. Możesz odpalić test end-to-end, zrobić screenshot, sprawdzić manualnie, że „użytkownik wkleja tekst i widzi zapisane karty”. Pozioma warstwa kończy się... istnieniem warstwy. Z perspektywy agenta to słaby sygnał, czy zrobił dobrą robotę.

- **Integracja.** Pionowy slice wymusza integrację warstw już przy pierwszym zadaniu. Konflikty interfejsów ujawniają się od razu, a nie po dwóch tygodniach zszywania.

- **Pozorny postęp.** Horizontal slicing pięknie wygląda na ekranie - katalogi pełne plików, schematy bazy, dziesiątki endpointów. Tyle że żaden użytkownik nie zobaczył jeszcze tego, po co produkt powstaje.

Dla 10xCards (PRD z preworku [\[4.2\]](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/15)) zła i dobra dekompozycja wyglądają tak:

![Obraz 4](https://images.przeprogramowani.pl/cms/04fd5d8a-b0df-4baf-8e90-f8dba7293def/cc943f2d16a3a8d916421c17dd1fc9678f8d3f0fd80d255c6db0c6f66dbcba53.png)

### Co z fundamentami?

„Ale czekaj, najpierw przecież potrzebuję bazy i auth, żeby cokolwiek działało” - tak, masz rację. Dlatego w roadmapie istnieje też sekcja **## Foundations**.

Foundation (oznaczany **F-NN**) to krótka, kontrolowana praca wstępna, która nie ma własnego user-visible outcome, ale **odblokowuje konkretny pionowy slice**. Każde **F-NN** musi mieć wypełnione pole **Unlocks: S-NN** - inaczej jest po prostu warstwą bez celu i trafia na parking.

Przykład źle zakwalifikowanego foundation:

- „F-XX kompletny model danych dla wszystkich encji w aplikacji” - bez konkretnego downstream slice'a. To horizontal drift przebrany za fundament.

Zasada brzmi prosto - żaden fundament nie istnieje bez wskazania zadania docelowego. Jeśli nie potrafisz wskazać pojedynczego, konkretnego pionowego slice'a, który ten fundament odblokowuje, to ta praca nie ma jeszcze miejsca w roadmapie.

### Trzy decyzje podczas wywiadu

Skill nie prowadzi pełnego wywiadu produktowego. Zadaje tylko te pytania, których PRD i baseline same nie domknęły:

- **Cel sekwencjonowania** (**main\_goal**) - feedback z rynku / jakość / niska złożoność / czas / nauka / coś innego. Każda opcja prowadzi do innej kolejności, kiedy dwa slice'y są równoważne.

- **Kierunek przewodni** (**north\_star**) - nadrzędny kierunek i najmniejszy działający przepływ, który udowadnia tezę produktu. Zwykle wskazuje na user story o najwyższym priorytecie.

- **Główne ryzyko** (**top\_blocker**) - decyzje / czas / dostępność / czynniki zewnętrzne / wiedza / motywacje / brak. Wpływa na to, co skill agresywniej parkuje.

To jest celowy kompromis. Nie chcemy wracać do modelu, w którym cała praca planistyczna spada na programistę: czytasz PRD, ręcznie rozpisujesz zależności, sam szukasz braków w repozytorium i jeszcze pilnujesz, żeby backlog nie odpłynął w stronę pracy warstwami. Po to mamy agenta, żeby wykorzystać jego zdolność do szybkiego czytania artefaktów, porównywania opcji i proponowania sensownej sekwencji.

Ale nie chcemy też trybu „AI-autopilota”, w którym agent po cichu decyduje, co jest najważniejszym przepływem produktu i jakie ryzyko należy zaatakować jako pierwsze. Te trzy pytania są punktem kontroli człowieka. Agent przychodzi z rekomendacją, uzasadnieniem i 1-2 alternatywami, a ty zatwierdzasz albo korygujesz decyzje, które realnie ustawiają roadmapę.

Każde pytanie ma jedną polecaną opcję z konkretnym uzasadnieniem („Vision mówi 'launch before X' plus **timeline\_budget: 1 week** -> recommend **speed**”), 1-2 alternatywy oraz opcję „coś innego - wyjaśnię”. Wywiad ma najwyżej trzy pytania (z drobnym wyjątkiem dla projektów o nietypowym kształcie MVP).

### Łańcuch artefaktów

![Obraz 3](https://images.przeprogramowani.pl/cms/04fd5d8a-b0df-4baf-8e90-f8dba7293def/0f9cbcd28fdb5b41c7d23e3011f5528354a41f055c480325caa5f48bc04f81fb.png)

Co który plik opisuje:

- **shape-notes.md** - surowy zapis sesji sokratejskiej. Decyzje, otwarte pytania, decyzje świadomie odłożone.

- **prd.md** - produktowy kontrakt. User stories, FR-y z priorytetami, success criteria, Non-Goals.

- **tech-stack.md** - techniczny hand-off. Wybrany framework, bazy, hosting, integracje, decyzje o auth i o docelowym środowisku deploymentu.

- **roadmap.md** - sekwencja zadań. Przygotowania, slice'y e2e, zależności, blokery, niewiadome.

- **Task (change-id)** - operacyjna jednostka pracy. Status, owner, acceptance criteria, link do roadmapy.

- **context/changes/\<change-id>/plan.md** - per-change implementation plan. Architektura jednego slice'a, kroki, pliki.

Każdy z tych artefaktów pokazuje ten sam projekt w innym przybliżeniu. PRD opisuje, co robimy i dla kogo. Tech-stack opisuje, czym to robimy. Roadmapa opisuje, w jakiej kolejności. Backlog opisuje, co teraz. Plan opisuje, jak konkretnie.

W tej lekcji budujemy **roadmap.md** i wstępny backlog.

### Czego skill świadomie nie robi

**/10x-roadmap** nie estymuje czasu pracy - w dobie agentów AI to naprawdę trudne. Nie ma „Day 1”, „Week 2”, t-shirt sizes ani story pointów. To świadoma decyzja, przystająca do realiów pracy z wirtualnymi współpracownikami.

Dodatkowo realizacja zadań z agentem jest nieliniowa - jeden slice może iść do przodu w godzinę albo w dwa wieczory, w zależności od tego, ile poprawek wymaga w pętli plan-implement-review. Zmyślone estymaty dawałyby fałszywe poczucie kontroli. Kolejność wykonywania zadań wynika z **Prerequisites**, tempo z **Blockers** i **Unknowns**.

Skill nie wybiera też frameworków, nie tworzy schematów bazy, nie definiuje endpointów API. To wszystko jest zadaniem właściwego planowania i implementacji, którymi zajmiemy się w kolejnych lekcjach.

### Ile slice'ów realizować w tym tygodniu

Roadmapa może mieć dwadzieścia pozycji i to jest w porządku. Nie znaczy to, że masz zamknąć je wszystkie w tym tygodniu.

Zacznij od przejścia wszystkich lekcji tego modułu i zrealizuj przy nich mniej więcej trzy slice'y. Tyle wystarczy, żeby przećwiczyć pełną pętlę - plan, implementacja, review, zamknięcie zadania - na własnym kodzie, a nie na przykładzie z lekcji. Po trzecim slice'ie masz już swoje dane do decyzji: wiesz, ile zajmuje ci jeden slice, gdzie tracisz czas i które fragmenty roadmapy okazały się źle zaplanowane.

Dopiero wtedy wybierasz jedną z dwóch dróg.

**Zatrzymaj się**, jeśli projekt zdążył urosnąć: ma własną logikę biznesową, realizuje konkretną funkcjonalność i da się go komuś pokazać. Masz wtedy działający produkt, a nie zbiór rozgrzebanych zadań. Reszta slice'ów nie znika - zostaje w roadmapie jako materiał na później.

**Jedź dalej**, jeśli celujesz w maksimum i chcesz zamknąć całą roadmapę. Warunek jest jeden: kolejne slice'y nadal przechodzą przez tę samą pętlę. Roadmapa domknięta pośpiesznie, bez review, zostawia projekt w gorszym stanie niż roadmapa zatrzymana świadomie w połowie.

Zamknięty milestone nie kończy projektu. Po MVP możesz wrócić do **/10x-shape** i **/10x-prd** i opisać nimi etap post-MVP - nowe funkcje, dług, którego świadomie nie spłaciłeś, rzeczy odłożone do **Parked**. Powstałe dokumenty wrzucasz ponownie do **/10x-roadmap** i mówisz agentowi, że otwierasz nowy rozdział. Skill zamknie poprzedni milestone, przeniesie go do **## Milestone History** i otworzy kolejny, z nowymi slice'ami i tą samą strukturą pliku.

## 🧑🏻‍💻 Zadania praktyczne

- **Wygeneruj `roadmap.md` dla swojego projektu.** Pobierz paczkę **m2l1** i uruchom **/10x-roadmap** w repo z gotowym **context/foundation/prd.md**. Przejdź wywiad świadomie - sam zdecyduj o **main\_goal**, **north\_star** i **top\_blocker** zamiast klikać domyślne rekomendacje. Cel: roadmapa z przynajmniej jednym slice'em w statusie **ready**, jasno wskazanym north star i bez osieroconych fundamentów. Jeśli wszystkie slice'y są **blocked**, potraktuj to jako sygnał, że PRD wymaga domknięcia lub doprecyzowania.

- **(Opcjonalne) Przenieś roadmapę do zewnętrznego backlogu przez agenta.** Załóż darmowe konto w wybranej usłudze i wykorzystaj Linear MCP lub GitHub CLI do utworzenia namacalnej, publicznej roadmapy projektu. Poproś agenta o utworzenie issues z sekcji **## Slices** - tytuł z **Outcome**, opis zawierający **PRD refs**, **Prerequisites** i **Risk**, labelki **slice** / **foundation** / **north-star**. Cel: backlog widoczny dla osoby spoza zespołu programistycznego, z odwzorowanymi zależnościami między ticketami i bez ręcznego klepania w UI. Pochwal się efektem na 10xDevs Arena.

## Opcjonalnie: zewnętrzny backlog

### Backlog jako pamięć projektu

Roadmapa pomaga ci podjąć decyzję, co budować i w jakiej kolejności, ale pamiętaj - projekt nie żyje tylko w twojej głowie i w jednym pliku Markdown. Właśnie dlatego na koniec tej lekcji chcemy zadbać o pełną przejrzystość, a przy okazji poznać kolejne istotne rozszerzenia współpracy z agentem.

Do tej pory nasza roadmapa, jako backlog zadań, odpowiadała na proste pytania: co teraz robimy, kto to prowadzi, co jest zablokowane, co czeka na review, co można wziąć jako następne. Bez tego status projektu rozlewa się po Slacku, DM-ach, komentarzach w PR-ach i pamięci kilku osób. Idziesz na urlop, chorujesz, bierzesz wolne - jest zator. Niby wszystko wiadomo, dopóki jedna osoba nie zniknie na dwa dni.

Teraz chcemy jeszcze zadbać o komunikację na zewnątrz. Szef, klient, PM albo stakeholder może wejść w Jirę, Linear, GitHub Projects czy publiczną tablicę roadmapy i zobaczyć projekt z lotu ptaka. Co jest w toku. Co jest zablokowane. Co czeka na dodatkowe zasoby. Co wypadło poza zakres pracy. Nie musi cię pingować co trzy godziny z pytaniem „i jak tam?”.

Ta proaktywna komunikacja „na zewnątrz” to naprawdę dobry lek na micromanagement. Nie dlatego, że narzędzie magicznie naprawia kulturę pracy. Po prostu widoczny stan projektu zmniejsza potrzebę ciągłego dopytywania. Jeśli backlog jest aktualny, rozmowa może dotyczyć decyzji i ryzyk, a nie ręcznego odpytywania o status.

**roadmap.md** realizuje tylko połowę tych założeń - działa na poziomie projektu, ale nie zapewnia przejrzystości dla osób spoza teamu.

Stąd backlog zewnętrzny, w bardziej klasycznej formie z UI - Jira, Linear, GitHub Projects czy dowolne z dziesiątek innych narzędzi - jako **operacyjna pamięć projektu i niższy próg wejścia dla każdego w firmie**.

Backlog robi rzeczy, których plik markdown nie zrobi out-of-the-box:

- **Status** - backlog/ready/in-progress/blocked/in-review/done, widoczny od razu.

- **Ownership** - kto pilnuje issue, kto ma na nim aktualny kontekst.

- **Dependencies** - link między issues, automatyczne odblokowywanie po zamknięciu prerekwizytu.

- **Acceptance criteria** - widoczne dla każdego, kto otwiera ticket, nie trzeba szukać w roadmapie.

- **Audit trail** - kto przesunął ticket, kiedy, dlaczego (komentarze).

Zostaje pytanie, jak wpiąć w to agenta.

### MCP i CLI: agent dostaje dostęp do systemu zadań

Poprzedni moduł zakończyliśmy, uzyskując dostęp do infrastruktury z terminala - przez CLI takie jak **wrangler**. Tutaj dokładamy kolejny wariant dostępu agenta do zewnętrznego systemu, tym razem do issue trackera.

Dzięki temu agent może dostać kontrolowany, narzędziowy dostęp do backlogu: czytać issues, tworzyć nowe pozycje, aktualizować statusy albo dopisywać komentarze. Czyli robić to, co normalnie robisz przez UI - tylko przez jawnie opisane narzędzia. Wszystko w twoim imieniu - na wyraźną prośbę, jako efekt uboczny hooka lub innego skilla albo w ramach automatyzacji. Jeśli z tego samego backlogu korzysta reszta zespołu, agent może ci przygotować np. poranny raport zadań, które na ciebie czekają, albo podsumować dzień, wymieniając bieżące osiągnięcia.

W zależności od tego, co udostępnia dany serwis, wybierzesz CLI (np. GitHub) lub MCP (np. Linear).

Cały schemat pracy może się opierać na trzech rodzajach akcji i zapytań:

- **Read** - „pokaż mi otwarte zadania w projekcie 10xCards z labelem **ready**”, „pokaż mi acceptance criteria dla TEN-14”.

- **Create** - „stwórz issue 'First gated generation loop' z kryteriami akceptacji, zależnościami i labelem **north-star**”.

- **Update** - „zmień status TEN-14 na **in-progress**”, „dołóż komentarz z linkiem do PR-a”.

![Obraz 5](https://images.przeprogramowani.pl/cms/04fd5d8a-b0df-4baf-8e90-f8dba7293def/4ebd336fc25c47e84e3df5464943d9f0f782e5699beecfb18234af58093b5c00.png)

W naszej lekcji zobaczymy, jak łatwo wykorzystać potencjał wspominanego już GitHub CLI oraz nowego serwera MCP Lineara:

- **Linear MCP** - <https://linear.app/docs/mcp> - oficjalny serwer MCP usługi Linear, z uwierzytelnianiem OAuth, kompatybilny z każdym popularnym agentem (Claude Code, Cursor, Zed i inne).

Linear MCP działa jako zdalny serwer MCP pod adresem **https://mcp.linear.app/mcp**. Łatwo podłączysz go do swojego narzędzia agentowego - wybierz wariant dla swojego narzędzia:

#### Claude Code

```
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
```

#### Codex

```
codex mcp add linear --url https://mcp.linear.app/mcp
```

#### Cursor

Oficjalny marketplace MCP zawiera connector Lineara - [Cursor Marketplace](https://cursor.com/marketplace).

***

Po podłączeniu i przejściu autoryzacji agent ma do dyspozycji narzędzia systemu Linear.

Pierwszym krokiem może być bezpośrednie przeniesienie roadmapy do tego narzędzia - przełoży się ona na labelki, zadania, projekty i zależności między zadaniami.

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1193148810" title="Odtwarzacz wideo Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>

### Granice dostępu agenta do backlogu

Tutaj wraca to samo pytanie, które warto zadawać przy każdym dostępie agenta do zewnętrznego systemu: **czy ten dostęp jest absolutnie konieczny, żeby agent zrobił to, co ma zrobić?**

Backlog jest na ogół bezpieczniejszy niż produkcja. Pomylenie statusu nie wywala bazy. Ale wciąż - masowe przestawianie statusów, kasowanie issues, dodawanie komentarzy „od ciebie” do tysiąca ticketów - to są działania widoczne dla zespołu i pozostawiają ślad w logach.

Praktyczne zasady dla projektów większych niż MVP:

- **Token z ograniczonymi uprawnieniami.** Nie wystawiaj agentowi admin-tokenu, kiedy potrzebujesz tylko czytania i tworzenia issues w jednym projekcie.

- **Akcje „destrukcyjne” tylko z poziomu UI.** Kasowanie projektu, zmiana ról, masowa zmiana statusów - kliknięcie w panelu kosztuje 30 sekund, sprzątanie po automatycznej pomyłce kilka godzin.

- **Audit log.** Linear, Jira i alternatywy enterprise mają wbudowane logi aktywności. Sprawdź je raz po pierwszej sesji z agentem, żeby zobaczyć, co agent realnie zrobił.

W zespole dochodzi kolejna warstwa: czy agent może zmieniać statusy issues *innych* osób, czy tylko swoich? Czy może komentować w cudzych ticketach? Te decyzje warto podjąć w zespole, zanim agent dostanie szeroki dostęp.

### Dla ambitnych: agent jako opiekun backlogu

Jeśli ten kierunek pracy ci się spodoba, jest tu sporo miejsca do eksperymentów. Agent z dostępem do issue trackera to jeden z najbardziej przystępnych sposobów na wprowadzenie automatyzacji AI do workflow zespołu. Nie musi od pierwszego dnia ruszać kodu produkcyjnego, a i tak realnie podnosi jakość pracy.

Co konkretnie taki agent może robić w roli opiekuna backlogu? Kilka pomysłów o różnym stopniu ambicji:

- **Codzienne sprzątanie.** Identyfikacja ticketów, które nie ruszyły się od kilku tygodni, zamykanie duplikatów, oznaczanie zadań bez właściciela albo bez kryteriów akceptacji.

- **Aktualizacja kontekstu.** Dopisywanie do issues linków do PR-ów, łączenie zadań z pasującymi slice'ami z roadmapy, dodawanie komentarzy ze świeżymi decyzjami zespołu.

- **Triage przychodzących zgłoszeń.** Tagowanie nowych ticketów, proponowanie priorytetu na podstawie definicji projektu, sugerowanie właściciela na podstawie historii pracy w danym obszarze.

- **Raporty na żądanie.** Poranne podsumowanie, co jest zablokowane, co czeka na review, co spadło z radaru, plus krótka rekomendacja „na czym najpierw się skupić”.

Nawet jeśli agent się pomyli, koszt naprawy jest niski. Zmienisz status, cofniesz komentarz, dopiszesz brakujące pole. Żadna pomyłka nie wywraca produkcji ani nie wprowadza buga do kodu. A jednocześnie korzyść narasta szybko, bo backlog, którym ktoś realnie się opiekuje, jest dużo użyteczniejszy niż lista nieaktualnych zadań, do której nikt nie zagląda.

To dobry punkt wyjścia do szerszej refleksji nad tym, gdzie jeszcze w twojej pracy AI może wnieść wartość bez bezpośredniego dotykania kodu produkcyjnego.

## Odbierz swoją odznakę

Po ukończeniu tej lekcji odbierz odznakę w sekcji [10xDevs Mission Log](https://platforma.przeprogramowani.pl/mission-log), a następnie pochwal się swoim osiągnięciem!

## Deep Dive

### Jak skill przygotowuje roadmapę

Skill robi pięć rzeczy po kolei:

**1. Ustala stan milestone'a.** Zanim dotknie PRD, czyta nagłówek **roadmap.md**. Jeśli żaden milestone nie jest otwarty, otwiera nowy. Jeśli któryś trwa, raportuje status i rekomenduje następny ruch zamiast generować roadmapę od zera. Jeśli wszystkie zadania są **done**, zamyka milestone i przechodzi do otwarcia kolejnego. Stan trzyma w samym **roadmap.md** - nie ma osobnego pliku ze stanem.

Przy otwieraniu milestone'a pyta, z czego go zbudować. Rekomenduje PRD, ale przyjmie też inne dokumenty albo twój własny opis - wtedy rozpisze go na ponumerowane kotwice zakresu **MS-NN**, do których slice'y będą się odnosić tak samo jak do **FR** i **US**.

**2. Sprawdza, czy PRD jest gotowy do roadmapowania.** Zaczynamy od prostej oceny w skali 0-4: czy sekcja Vision jest wypełniona, czy są user stories z Given/When/Then, czy istnieje co najmniej jeden must-have FR, czy Business Logic ma sensowną treść (nie **# TODO: domain rule**). Wynik poniżej 3 zatrzymuje proces do czasu twojej decyzji: skill rekomenduje domknięcie PRD, ale pozwala świadomie kontynuować i zapisać braki jako blokujące niewiadome.

To świadome zabezpieczenie. Roadmapa wygenerowana z dziurawego PRD odziedziczy dziury jako „blocked slices” - i będzie głównie listą rzeczy, których jeszcze nie wiesz. Czasem taki wynik jest przydatny, ale nie udawajmy wtedy, że mamy gotowy plan realizacji.

**3. Audytuje kod projektu.** Skill puszcza równoległych subagentów na sześć warstw - frontend, backend/API, data, auth, deploy, observability - i każdy zwraca jednowierszowy werdykt: present, partial albo absent, z odnośnikiem do pliku-dowodu. To zastępuje pytanie „co już masz w projekcie?” - sam kod jest najpewniejszym źródłem. Jeśli pracujesz w stacku innym niż **web**, ten fragment możesz dopasować do swoich potrzeb.

**4. Prowadzi minimalny wywiad.** Skill nie prowadzi pełnego wywiadu produktowego. Zadaje tylko te pytania, których PRD i baseline same nie domknęły.

**5. Generuje artefakt `context/foundation/roadmap.md`.** Z PRD budujemy pionowe slice'y, ze wstępnego rozpoznania projektu wyciągamy warstwy oznaczone jako **absent** albo **partial** (kandydatów na foundations), ustawiamy kolejność (foundations najpierw, north star tak wcześnie, jak pozwalają wymagania wstępne), domykamy **backlog handoff** i parkujemy to, co świadomie odrzucasz.

### Format pliku roadmap.md

Skill jest skonstruowany tak, żeby roadmapy generowane w kolejnych sesjach miały stałą strukturę. Jedyny wyjątek to **## Streams** - ta sekcja pojawia się tylko wtedy, gdy graf zależności zadań jest na tyle rozgałęziony, że dodatkowa mapa „większych strumieni” naprawdę pomaga.

```
## Milestone
## Vision recap
## North star
## At a glance
## Streams (opcjonalnie)
## Baseline
## Foundations
## Slices
## Backlog Handoff
## Open Roadmap Questions
## Parked
## Milestone History
## Done
```

Nazwy sekcji są kontraktem - **/10x-plan** i inne narzędzia po nich grepują, więc nie zmieniaj ich w locie. **## Milestone** otwiera plik i opisuje bieżący milestone: jego intencję, materiały źródłowe, warunek zamknięcia i kotwice zakresu. **## Milestone History** zbiera te już zamknięte. W nagłówku pliku dochodzą do tego trzy klucze - **milestone\_id**, **milestone\_seq** i **milestone\_status** - i to z nich skill odczytuje przy kolejnym uruchomieniu, na jakim etapie jesteś.

Powyższa lista to punkt wyjścia, nie sztywny standard. Po kilku iteracjach zobaczysz pewnie, że twojemu projektowi przydałoby się dodatkowe pole w slice'ie, inna sekcja na początku albo bardziej zwięzłe statusy. Wystarczy, że otworzysz plik **SKILL.md** w paczce i dopasujesz format do siebie - skill to artefakt, który może ewoluować razem z twoim workflow.

Jeśli pracujesz w zespole, dochodzi jeszcze jeden wymiar - naturalny rytm pracy całej grupy. Roadmapa układana co tydzień, rozliczana per sprint albo per release wygląda inaczej. Warto, żeby agent generujący **roadmap.md** znał wasze konwencje: nazwy strumieni pracy, oznaczenia priorytetów, sposób grupowania prerekwizytów, częstotliwość przeglądów. Im lepiej wynik pasuje do waszego dotychczasowego procesu, tym łatwiej przekonać resztę zespołu, żeby realnie pracowała z tą roadmapą, a nie z równoległymi źródłami prawdy.

### Przykłady slice’a i fundamentów

Podejście **vertical-first** prowadzi pracę do **north star slice'a** - najmniejszego działającego przepływu, który udowadnia tezę produktu. W 10xCards jest nim S-04, czyli pierwsza ocena karty w sesji powtórki. Droga do niego zaczyna się od S-01 „First gated generation loop”: wklejasz tekst, dostajesz wygenerowane karty, akceptujesz lub odrzucasz każdą z osobna, zaakceptowane lądują w decku. Produkt realnie zaczyna obsługiwać fiszki.

Jeśli north star działa, projekt ma sens. Jeśli nie - reszta planu jest gimnastyką wokół czegoś, co i tak nie zadziałało.

Przykłady uzasadnionych foundations (F-01 pochodzi z roadmapy powyżej, F-03 i F-04 to fundamenty, które mogłyby do niej dojść):

- **F-01 gate-product-routes** - objęcie produktowych ścieżek ochroną logowania, **odblokowuje S-01** (bez sesji nie pokażemy „moich” kart).

- **F-03 openrouter-privacy-spike** - krótki spike weryfikujący opcje kontroli prywatności u dostawcy LLM, **odblokowuje S-01** (bez tego nie wiemy, czy wrzucanie tekstu użytkownika do LLM-a mieści się w wymaganiach PRD).

- **F-04 srs-library-spike** - sprawdzenie kontraktu wybranej biblioteki SRS, **odblokowuje S-04 review session** (PRD świadomie zostawia szczegóły SRS na potem).

### Anatomia jednego slice'a

Każdy slice w **## Slices** ma ten sam zestaw pól. Wypełnione dla 10xCards S-01 wyglądają mniej więcej tak:

```
### S-01: First gated generation loop

- **Outcome:** User can paste source text, request a card batch, accept/reject each
  candidate, and finalize accepted cards into the deck.
- **Change ID:** first-gated-generation
- **PRD refs:** US-01, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012
- **Prerequisites:** F-01 (gate-product-routes), F-03 (openrouter-privacy-spike)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Czy OpenRouter privacy mode pokrywa wymaganie z PRD? — Owner: ty. Block: yes.
- **Risk:** This slice is the product wedge — if it doesn't work,
  nothing downstream matters. Sequenced first because everything else is
  read/edit on top of cards this loop produces.
- **Status:** blocked
```

Status **blocked** zapala się automatycznie, kiedy choć jeden Unknown ma **Block: yes**. Dopóki nie rozstrzygniesz pytania o OpenRouter privacy, slice nie jest gotowy do implementacji. To dobra wiadomość - skill mówi ci wprost, czego nie wiesz, *zanim* natkniesz się na to w trakcie kodowania.

Pole **Outcome** opisuje działanie użytkownika: „user can ...”. To kontrola jakości - jeśli nie potrafisz napisać tego zdania, slice prawdopodobnie nie jest pionowy, a ty nadal myślisz niezależnymi warstwami.

Pole **PRD refs** musi zawierać konkretne identyfikatory z PRD. Skill po wygenerowaniu robi **self-review** i upewnia się, że każda sekcja must-have z PRD znajduje się w co najmniej jednym slice'ie - bo inaczej jakiś wymóg „zginie w roadmapie”.

Pole **Risk** to jedno zdanie odpowiadające na pytanie „dlaczego tę decyzję podejmujemy *tu* w sekwencji”. Dzięki temu osoba, która za pół roku przejrzy roadmapę, zrozumie, dlaczego ten wybór był sensowny.

### Dlaczego rekomendacja zmieniła się od 10xDevs 2.0

Część z was może pamiętać, że we wcześniejszych edycjach 10xDevs praca z agentami była bardziej horyzontalna.

To miało sens przy ograniczonych możliwościach modeli, gdzie człowiek częściej ręcznie sklejał warstwy i „naprawiał po AI”. Pisanie ręcznie schematu, potem ręcznie endpointów, potem ręcznie komponentów - to była naturalna sekwencja, bo każdy z tych kroków wymagał tej samej pary rąk.

W 2026 r. agenci typu Claude Code i Codex (a niedługo pewnie dziesiątki kolejnych) realnie zmieniają ten układ. Z dokumentacji Anthropic ([Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)) i z opisu działania Codexa ([Introducing Codex](https://openai.com/index/introducing-codex/)) wynika jedna istotna zmiana w sposobie pracy: **agent działa najlepiej, kiedy dostaje zawężony task z weryfikowalnym wynikiem**.

Vertical slice realizuje właśnie to założenie. Pozioma warstwa „stwórz schemat bazy” nie ma weryfikowalnego wyniku poza „istnieje plik z migracjami” - to słaby sygnał, czy schemat jest dobry. Pionowy slice „użytkownik wkleja tekst i zapisuje pierwszą kartę” ma jasne kryteria sukcesu i da się je przetestować end-to-end (nawet manualnie, a w wersji docelowej - z testami).

Bardziej spostrzegawczy zauważą zapewne, że mocno czerpiemy z dziesięcioleci doświadczeń branży. Agile Alliance od lat opisuje, jak [dzielić user stories](https://agilealliance.org/glossary/story-splitting/) z zachowaniem mierzalnej wartości biznesowej. [Story mapping](https://agilealliance.org/glossary/story-mapping/) jeszcze mocniej kładzie nacisk na „walking skeleton” - minimalną, ale realnie działającą wersję produktu jako pierwszy milestone. Vertical-first w pracy z agentem to praktyczne zastosowanie tych zasad w nowym układzie ról: agent wykonuje, ty sterujesz.

Co to znaczy dla ciebie? Jeśli kiedyś planowałeś projekty warstwami, twoja intuicja inżynierska nie jest zła. Zadania czysto techniczne i bardziej warstwowe nadal istnieją w sekcji **## Foundations** w roadmapie, tylko nie mogą już być osierocone - każdy fundament musi wskazywać konkretny user-visible slice, który odblokowuje.

### Co zrobić, jeśli twój projekt naprawdę potrzebuje horizontal-first

Są projekty, w których pierwszy ruch jest faktycznie poziomy. Oto trzy typowe sytuacje:

- **Integracja z legacy.** Bez warstwy adaptacji do istniejącej bazy lub API nie da się zacząć pionowego slice'a. Wtedy F-01 to spike integracyjny z konkretnym **Unlocks: S-01**.

- **Wymóg compliance/security.** Przepisy (np. GDPR plus szczegóły retencji) wymuszają decyzję o modelu danych, zanim będzie można cokolwiek pokazać użytkownikowi. Wtedy F-01 to praca nad modelem danych z **Unlocks** wskazującym slice, który mógłby naruszyć compliance.

- **Performance-critical core.** Niektóre projekty (real-time, embedded, systemy niskopoziomowe) wymagają wczesnej decyzji architektonicznej, której zła wersja zablokuje cały projekt. Wtedy F-01 to architektoniczny spike z **Unlocks** wskazującym pierwszy demonstracyjny przepływ.

W każdej z tych sytuacji praca pozioma jest **konkretna, ograniczona i przypięta do konkretnego pionowego slice'a**. Nigdy nie jest „najpierw cała baza, potem całe API”. Skill **/10x-roadmap** uwzględnia to, rozbudowując sekcję **## Foundations** i nadając status **blocked** slice'om, które czekają na te fundamenty.

Jeśli czytasz wygenerowany **roadmap.md** i widzisz, że masz pięć F-NN, a żaden pionowy slice nie ma statusu **ready**, to sygnał, że albo PRD jest zbyt obciążony technicznymi wymaganiami, albo **/10x-roadmap** źle zinterpretował baseline. Wszystkie mniej typowe scenariusze możesz skonsultować na platformie kursowej.

Powodzenia!

## Materiały Dodatkowe

- **Best practices for Claude Code** / Anthropic / <https://code.claude.com/docs/en/best-practices> - dlaczego zawężone, weryfikowalne zadania sprawdzają się w pracy z agentem lepiej niż szerokie polecenia.

- **Story Splitting** / Agile Alliance / <https://agilealliance.org/glossary/story-splitting/> - klasyczne reguły dzielenia user stories z zachowaniem wartości biznesowej.

- **Story Mapping** / Agile Alliance / <https://agilealliance.org/glossary/story-mapping/> - „walking skeleton” jako pierwszy milestone i koncepcyjne zaplecze dla vertical-first roadmapowania.

- **A Tale of Slicing and Imagination** / Agile Alliance experience report / <https://agilealliance.org/resources/experience-reports/a-tale-of-slicing-and-imagination/> - praktyczny opis, dlaczego horizontal slicing wygląda kusząco w zespołach o silnych specjalizacjach i dlaczego z punktu widzenia produktu jest słabszą strategią.

- **What is a Project Roadmap** / Atlassian / <https://www.atlassian.com/agile/project-management/create-project-roadmap> - osadza roadmapę w klasycznym pojęciu project managementu (cele, milestones, dependencies); pomija estymaty czasowe, które **/10x-roadmap** świadomie odrzuca.

- **Project Manager Roles and Responsibilities** / Atlassian / <https://www.atlassian.com/en/work-management/project-management/project-manager> - obowiązki PM-a jako roli łączącej cel z realizacją; tłumaczy, dlaczego „TPM” jest dobrym modelem myślowym dla programisty z agentem.

- **Model Context Protocol - Server Concepts** / MCP / <https://modelcontextprotocol.io/docs/learn/server-concepts> - minimalny model myślowy: tools, resources, prompts, zgoda użytkownika.

- **Linear MCP Server** / Linear / <https://linear.app/docs/mcp> - dokumentacja oficjalnego zdalnego serwera MCP Lineara (OAuth, kompatybilność z głównymi klientami).
