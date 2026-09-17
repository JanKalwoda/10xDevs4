---
title: "Od pomysłu do PRD: Metoda Sokratejska z Agentem"
course: "10xdevs-4"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-09-17"
format: "markdown"
---

![M1L2 - Intro](https://images.przeprogramowani.pl/cms/6f9ebb0c-756a-442a-8a65-068964a49573/d6063e9ad8dedbcf821c7cbb6ef4b86e804901cd3b96c5a398e676b155a8f500.jpg)

## Witaj w 10xDevs 4.0!

Cieszymy się, że wspólnie z nami chcesz odkrywać świat AI-Native Software Engineeringu. Czeka na ciebie 5 tygodni nauki, w trakcie których wspólnie odkryjemy kolejne obszary wykorzystywania AI w pełnym cyklu wytwarzania oprogramowania - zarówno solo jak i w zespole.

W pierwszym tygodniu poznasz metody efektywnego onboardingu Agentów AI do swoich projektów, zaprojektujesz wstępny kształt MVP, powołasz je do życia, a na koniec po raz pierwszy wdrożysz na produkcję i otrzymasz publiczny link, którym możesz się podzielić z innymi.

Trzymamy za ciebie kciuki, zachęcamy do współpracy i wymiany doświadczeń z ponad 2500+ uczestników z najlepszych firm IT, a także do uczestnictwa w spotkaniach LIVE, gdzie odwiedzą nas topowi goście.

A teraz… budujemy!

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1192850361" title="Odtwarzacz wideo Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>

## Od pomysłu do określenia problemu

Pierwsza pułapka w projekcie kursowym pojawia się zanim napiszesz pierwszą linię kodu.

Masz pomysł. Czasem nawet całkiem sensowny: aplikacja do fiszek z AI, system notatek, dashboard dla freelancerów, wewnętrzne narzędzie do firmy. Brzmi dobrze, bo na tym etapie pomysł nie musiał jeszcze odpowiedzieć na żadne niewygodne pytanie.

A potem wchodzisz w kod, dokładasz logowanie, dashboard, kilka tabel, widok statystyk... i po dwóch tygodniach okazuje się, że nadal nie wiadomo, co to właściwie za aplikacja.

Kto będzie jej używał? Jaki jest pierwszy wartościowy przepływ? Co wypada z MVP? Co robimy, kiedy użytkownik nie wróci po tygodniu?

No właśnie.

Dlatego pierwszym ruchem w 10xDevs nie jest implementacja bałaganu myśli. Pierwszym ruchem jest uporządkowanie projektowych założeń, z którymi rozpoczynasz nasze szkolenie.

W preworku zebrałeś trzy elementy tej układanki: [kryteria dobrego projektu kursowego](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/15) (prework 4.2), [pojęcie Agenta jako systemu działającego w kontrolowanym środowisku](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/02) (prework 1.2) i [intuicję, że prompt do Agenta to kontrakt](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/10) (prework 3.2).

Teraz łączymy te trzy rzeczy w pierwszy realny workflow, do którego stopniowo będziemy dodawać kolejne elementy.

Zanim Agent dostanie repozytorium, dostaje twój pomysł. I podda go odpowiedniej weryfikacji i ustrukturyzowaniu. Już w pierwszej lekcji powinieneś poczuć, że potencjał nowoczesnego AI w znaczny sposób wykracza poza pisanie kodu. To ważne, ale to tylko element wpływu tej technologii na cały proces wytwarzania oprogramowania.

Jeśli wahasz się, czy warto rozwijać swój pomysł, możesz zacząć od **/10x-idea-check**. Opisujesz pomysł w kilku zdaniach, a Agent pomaga ocenić, czy warto przejść do sesji planistycznej, zmienić zakres, czy najpierw sprawdzić konkretną przeszkodę. Bierze przy tym pod uwagę twoje doświadczenie, sposób pracy z agentami i czas do wybranego terminu oddania. Jeśli masz już wybrany kierunek, przejdź od razu do **/10x-shape**.

## Najpierw doprecyzowanie, potem zapis ustaleń

### Dlaczego Agent powinien pytać, a nie tylko przyjmować rozkazy

Wymagania produktowe zaczynają się od języka naturalnego. Człowiek opisuje problem, pomija oczywistości, miesza życzenia z decyzjami i zakłada, że druga strona "wie, o co chodzi".

Jeśli od razu poprosisz model o dowolny artefakt (np. dokument z wymaganiami), uzupełni braki najbardziej prawdopodobnymi założeniami. Rzadko dopyta, rzadko wykryje luki, zrealizuje po prostu twoje polecenie. Dostaniesz tekst, który wygląda kompletnie, ale może zawierać decyzje, których nigdy nie podjąłeś.

W pracy agentowej to szczególnie niebezpieczne. Agent potrafi potem bardzo konsekwentnie implementować błędne założenie. Dlatego wybieramy inną kolejność działań: polecenie, pytania doprecyzowujące wszystkie luki, a dopiero potem tworzenie wynikowego artefaktu.

### PRD jako kontrakt dla kolejnych kroków

W preworku mówiliśmy o prompcie agenta jako kontrakcie w ramach lokalnej sesji rozmowy. Dokument PRD (Product Requirements Document, znany na długo przed epoką AI) działa podobnie, ale na wyższym poziomie.

Prompt zadaniowy mówi: "wykonaj to konkretne polecenie".

PRD mówi: "to są kluczowe ramy dla projektu, w którym będę ci wydawał polecenia".

Bez PRD kolejne prompty zaczną dryfować. Raz poprosisz o logowanie, raz o dashboard, raz o przypomnienia, raz o statystyki.

Każdy prompt osobno może brzmieć poprawnie, ale całość zacznie przypominać produkt złożony z przypadkowych zachcianek.

PRD, jako dokument nadrzędny, nadaje Agentowi stabilniejszy punkt odniesienia:

- użytkownik i problem ograniczają fantazję,

- zakres ogranicza rozrost funkcji,

- non-goals chronią przed "przy okazji doróbmy jeszcze...",

- kryteria sukcesu pomagają później pisać plan i akceptację,

- otwarte pytania przypominają, gdzie nadal nie mamy pewności.

Dobrze poprowadzona sesja wymusza decyzje, które samodzielnie bardzo łatwo ominąć. Zapisany kontrakt sprawia, że twoje kolejne prompty już ich nie podważą.

## 10xWorkflow: od rozmowy do PRD

Osiągniemy to wykorzystując pierwsze trzy narzędzia z 10xWorkflow, czyli naszego autorskiego zestawu Skilli dla Agentów AI. Będziemy je wprowadzać stopniowo, tłumacząc, jakie założenie stoi za każdym z nich i jak ty możesz odtworzyć podobne narzędzia w swoim środowisku.

Na start - sesja ze Skillem **/10x-shape**, czyli rozmowa, w której Agent chce wprowadzić porządek. Po niej wprowadzamy **/10x-prd**, czyli etap, który zapisuje ustalenia jako kontrakt.

Niezależnie od tego, czy zaczniesz od sprawdzenia pomysłu, z lekcji wychodzisz z dwoma artefaktami: **shape-notes.md** jako zapisem sesji planistycznej i **prd.md** jako kontraktem wejściowym do dalszej pracy.

### Od wyboru pomysłu do zapisu ustaleń

W tej lekcji poznasz trzy skille, które pomagają na kolejnych etapach pracy nad pomysłem. Z pierwszego korzystasz wtedy, gdy potrzebujesz pomocy w wyborze kierunku. Dwa kolejne prowadzą cię przez planowanie i zapis decyzji.

- **Skill**: **/10x-idea-check** | **W czym pomaga?**: czy warto rozwijać ten pomysł przy moim doświadczeniu i dostępnym czasie? | **Wynik**: krótka rekomendacja i następny krok, w samej rozmowie

- **Skill**: **/10x-shape** | **W czym pomaga?**: co dokładnie chcę zbudować lub zmienić? | **Wynik**: **shape-notes.md** z zapisem twoich decyzji

- **Skill**: **/10x-prd** | **W czym pomaga?**: jak zapisać te decyzje jako kontrakt do dalszej pracy? | **Wynik**: **prd.md** z uporządkowanymi wymaganiami

Nadal powstaną dwa główne pliki: **shape-notes.md** i **prd.md**. **/10x-idea-check** domyślnie odpowiada w rozmowie, bez dodatkowego dokumentu.

**/10x-shape** prowadzi sesję sokratejską. Pyta, drąży, łapie luki. Nie wymyśla za ciebie, co budujesz. Wymusza, żebyś jasno to opisał.

Wynik to **shape-notes.md**: zapis decyzji, które podjąłeś.

**/10x-prd** to drugi krok. Bierze **shape-notes.md** i przepisuje go do PRD o ustalonej strukturze, wiernie, bez domyślania się i dopowiadania. Jeśli czegoś brakuje w notatkach, wpisuje to wprost w sekcji **## Open Questions**, tak abyś mógł uzupełnić wykryte luki.

Wynik to **prd.md**: kontrakt, na podstawie którego Agent będzie rozumiał co chcemy osiągnąć w tym projekcie.

![Obraz 1](https://images.przeprogramowani.pl/cms/6f9ebb0c-756a-442a-8a65-068964a49573/17cea76c5e52bcfc83b2c983300049edd743da59911ea2c6829daed63378542e.png)

## Przygotowanie do pracy

Jeśli potrzebujesz pomocy w wyborze agenta AI i modelu, zajrzyj do sekcji „Jakie modele i narzędzia wybrać” w Deep Dive na końcu lekcji.

### Pobranie skilli przez 10x-cli

Zanim przejdziesz do praktyki i odpalisz **/10x-shape**, potrzebujesz kursowego [10x-cli](https://github.com/przeprogramowani/10x-cli): narzędzia, które dostarcza skille i materiały do twojego projektu.

Zapraszamy do filmu instraktużowego z tego jak korzystać z narzędzia, poniżej znajdziesz również tekstowy poradnik. Aktualne informacje o wspieranych komendach znajdziesz zawsze w [README.md](https://github.com/przeprogramowani/10x-cli) projektu:

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1192952264" title="Odtwarzacz wideo Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>

Nie musisz go instalować globalnie. Uruchamiasz je przez **npx** z tagiem **@latest**, żeby zawsze mieć najnowszą wersję:

```
npx @przeprogramowani/10x-cli@latest auth
```

**auth** zapyta Cię o adres email, który jest przypisany do Twojego konta na platformie Circle. Następnie wyśle magic link na ten adres. Klikasz link, CLI zapisuje token lokalnie i od tego momentu masz dostęp do materiałów. To jednorazowy krok, nie musisz go powtarzać przy każdej lekcji.

Drugi krok to pobranie paczki skilli dla tej lekcji:

```
npx @przeprogramowani/10x-cli@latest get m1l1
```

CLI pobiera skille z serwera i zapisuje je w twoim projekcie. Dla Claude Code lądują w **.claude/skills/**, dla Cursora w **.cursor/skills/**, dla Copilota w **.github/skills/**.

Każda lekcja ma swoją paczkę a **m1l1** to znacznik pierwszej lekcji w pierwszym module. W kolejnej lekcji będzie to **m1l2** itd.

W paczce do tej lekcji dostaniesz **/10x-idea-check**, **/10x-init**, **/10x-shape** i **/10x-prd**. Zacznij od **/10x-idea-check**, jeśli chcesz sprawdzić swój kierunek. Gdy jesteś gotowy na sesję planistyczną, użyj **/10x-init**, a potem **/10x-shape**.

Ponowne uruchomienie tej samej komendy **get m1l1** jest bezpieczne: CLI sprawdza, co już masz, i aktualizuje tylko to, co się zmieniło.

### Helper skille do obsługi 10xCLI

CLI dostarcza też [helper skille](https://github.com/przeprogramowani/10x-cli/tree/master/skills), które uczą twojego agenta, jak pracować z tym narzędziem. Na starcie najważniejszy jest **10x-cli-setup**, skill, który przeprowadzi cię (a właściwie twojego agenta) przez instalację, autentykację i konfigurację CLI pod wybrane narzędzie AI. Jeśli coś nie zadziała przy **auth** albo **get**, agent z tym skillem potrafi zdiagnozować problem i poprowadzić cię do rozwiązania.

Zainstaluj go przez **npx skills**:

```
npx skills add przeprogramowani/10x-cli
```

Jeśli chcesz, żeby helper skille były dostępne we wszystkich twoich projektach, dodaj flagę **-g**:

```
npx skills add przeprogramowani/10x-cli -g
```

Alternatywnie, jeśli nie używasz **npx skills**, możesz pobrać **SKILL.md** bezpośrednio z [repozytorium na GitHubie](https://github.com/przeprogramowani/10x-cli/tree/master/skills/10x-cli-setup) i umieścić go ręcznie w katalogu skilli swojego agenta (np. **.claude/skills/10x-cli-setup/SKILL.md**).

W paczce jest też **10x-cli-guide** - skill do codziennego użycia, który uczy agenta jak korzystać z 10xCLI: pobieranie paczek, listowanie modułów, przełączanie profili narzędzi, diagnostyka błędów

### Sprawdź pomysł za pomocą /10x-idea-check

Nie potrzebujesz gotowych wymagań ani repozytorium z kodem. Wystarczy kilka zdań o tym, co chcesz zbudować lub zmienić. Uruchom skill w swoim agencie:

```
/10x-idea-check Chcę narzędzie do planowania posiłków na podstawie produktów,
które mam w domu. Rozważam też integrację ze sklepami. Programuję od dwóch lat,
ale z agentem zrobiłem dotąd tylko małą zmianę. Mam około 5 godzin tygodniowo
i chciałbym oddać projekt w drugim terminie.
```

Możesz też wpisać samo **/10x-idea-check** — Agent poprosi wtedy o opis pomysłu, a jeśli czegoś istotnego zabraknie, dopyta. Nie musisz wcześniej znać wszystkich funkcji, reguł biznesowych ani technologii. Te decyzje doprecyzujesz dopiero podczas sesji planistycznej.

Skill bierze pod uwagę dwie różne rzeczy: doświadczenie programistyczne i doświadczenie w *kończeniu* projektów z agentami. Jeśli sprawnie korzystasz z ich pomocy i weryfikujesz wyniki, może zaproponować ambitniejszy zakres. Jeśli dopiero zaczynasz albo masz mało czasu, pomoże znaleźć pierwszy przepływ, który da się uruchomić i sprawdzić. Sam wybór mocnego modelu nie zastępuje oceny, czy rezultat faktycznie działa.

Możesz otrzymać jedną z trzech rekomendacji:

- **Przejdź do sesji planistycznej** — możesz już zacząć doprecyzowywać pomysł.

- **Rozważ zmianę zakresu** — Agent proponuje, co dodać lub odłożyć przy twoim doświadczeniu i dostępnym czasie.

- **Najpierw wyjaśnij przeszkodę** — sprawdź na przykład dostęp do danych albo zgodę na pracę z systemem firmowym.

Nic nie stoi na przeszkodzie, żeby zacząć od jednego działającego przepływu, a potem rozbudować go do ambitniejszego MVP. Skill uwzględnia też terminy certyfikacji: gdy zakres jest zbyt duży na wybrany termin, podpowie, co odłożyć albo który późniejszy termin rozważyć. Zakres i termin zgłoszenia wybierasz jednak ty — aktualne daty znajdziesz zawsze w harmonogramie kursu.

Przykładowa odpowiedź dla pomysłu z planowaniem posiłków:

> Proponuję zacząć od wersji bez integracji ze sklepami. Ręczne wpisanie dostępnych produktów pozwoli sprawdzić, czy propozycje posiłków są dla ciebie użyteczne. Integrację możesz rozważyć później. Podczas sesji doprecyzujesz zasady doboru posiłków i zakres pierwszej wersji.

O zaliczeniu projektu decydują ostatecznie prowadzący, na podstawie tego, co oddasz — rekomendacja z idea checku nie jest żadną gwarancją. Na tym etapie wystarczy pomysł na narzędzie dla siebie, rodziny albo zespołu. Możesz też opisać zmianę w istniejącej aplikacji.

Przeczytaj rekomendację i zdecyduj, które propozycje przyjmujesz. Potem przygotuj folder **/context** zgodnie z kolejną sekcją i uruchom **/10x-shape**, przekazując opis pomysłu z zaakceptowanymi zmianami. Agent nie uruchomi kolejnego skilla za ciebie.

### Przygotowanie folderu /context: /10x-init

Przed sesją planistyczną użyj **/10x-init**, aby zainicjalizować folder **/context** w swoim projekcie. To krok przygotowawczy: w **context/foundation/** znajdą się później notatki z **/10x-shape** i dokument wygenerowany przez **/10x-prd**.

## Krok pierwszy: sesja /10x-shape w praktyce

Po wybraniu pomysłu przechodzisz do **/10x-shape**. Podczas sesji ustalisz dokładny zakres i reguły działania aplikacji.

Weźmy 10xCards, przykładową aplikację do tworzenia i powtarzania fiszek z AI.

Pierwsza wersja pomysłu brzmi tak:

```
## 10xCards - MVP

### Główny problem
Manualne tworzenie wysokiej jakości fiszek edukacyjnych jest czasochłonne, co zniechęca do korzystania z efektywnej metody nauki jaką jest spaced repetition.

### Najmniejszy zestaw funkcjonalności
- Generowanie fiszek przez AI na podstawie wprowadzonego tekstu (kopiuj-wklej)
- Manualne tworzenie fiszek
- Przeglądanie, edycja i usuwanie fiszek
- Prosty system kont użytkowników do przechowywania fiszek
- Integracja fiszek z gotowym algorytmem powtórek

### Co NIE wchodzi w zakres MVP
- Własny, zaawansowany algorytm powtórek (jak SuperMemo, Anki)
- Import wielu formatów (PDF, DOCX, itp.)
- Współdzielenie zestawów fiszek między użytkownikami
- Integracje z innymi platformami edukacyjnymi
- Aplikacje mobilne (na początek tylko web)

### Kryteria sukcesu
- 75% fiszek wygenerowanych przez AI jest akceptowane przez użytkownika
- Użytkownicy tworzą 75% fiszek z wykorzystaniem AI
```

To nie jest zły start, żeby myśleć o MVP. Ale to jeszcze za mało, żeby zaczynać implementację.

Kto jest użytkownikiem? Co znaczy "powtarzanie"? Który moment w aplikacji daje realną wartość? Czy pod spodem jest jakakolwiek logika biznesowa, czy to kolejny CRUD z ładnym opisem?

Mając taki opis, pokusa jest prosta, żeby napisać do agenta: "przygotuj PRD dla aplikacji do fiszek z AI". Model odpowie składnie, często nawet profesjonalnie. Tyle że taki dokument tylko elegancko opakuje brak istotnych konkretów.

Sesja **/10x-shape** wymusza inną drogę.

### Przebieg sesji planistycznej

Agent przejmuje prowadzenie. Przeprowadza cię przez sześć faz w stałej kolejności:

![Obraz 2](https://images.przeprogramowani.pl/cms/6f9ebb0c-756a-442a-8a65-068964a49573/e6eb53ee28dfb2756e6b501dbceb0755a2c42c6c1484fab115c954b47ddef378.png)

W fazie **Vision & problem** Agent pyta: co dokładnie chcesz rozwiązać i czemu. W naszym przykładzie to moment, kiedy "aplikacja do fiszek z AI" musi się zmienić w konkretny problem konkretnej osoby.

W fazie **Persona & access control** pyta: kto z tego korzysta i jakie ma prawa. "Użytkownik" to za mało. Agent dociśnie cię do "dorosły learner, który sam dobiera materiały i po sesji nauki chce zamienić przeczytany tekst w fiszki, którym ufa."

W fazie **MVP discipline** przychodzi weryfikacja zakresu. Jeśli twój pierwszy przepływ wymaga więcej niż trzech tygodni pracy po godzinach, Agent nie zabroni. Ale wyłoży na stół koszt i poprosi o świadome potwierdzenie, że bierzesz dłuższy timeline na siebie.

W fazach **Functional Requirements (FRs) + user stories** i **Business logic + data** wymagania rozpisują się na konkretne decyzje. Agent uruchamia tu dwa mechanizmy, które łatwo ominąć w samodzielnym myśleniu:

- **Wyzwanie sokratejskie dla każdego FRa** — przy każdym wymaganiu pyta: "co musiałoby być prawdą, żeby ten FR był błędny?". To test, czy umiesz obronić własną decyzję i czy przemyślałeś jej implikacje.

- **Wykrywanie pustego CRUDa** — jeśli twoja logika biznesowa to "user dodaje fiszki i przegląda je", Agent powie ci wprost, że brakuje tu reguły domenowej, i pokaże, czym to skutkuje dalej. Podpowie kierunki: generacja fiszek z wklejonego tekstu, bramka akceptacji/odrzucenia przed zapisem, algorytm powtórek. Nie zablokuje sesji — możesz ją zamknąć z otwartym pytaniem — ale odznaka Builder wymaga logiki biznesowej, więc lepiej wiedzieć o tym teraz niż po dwóch tygodniach. Prosty pomysł jest w porządku; chodzi o to, żeby coś w nim faktycznie decydowało, a niekoniecznie o to, żeby dodać do niego AI.

### Końcowa kontrola decyzji

Na koniec sesji Agent przechodzi przez **closing soft-gate** i weryfikuje nagromadzone decyzje pytaniami kontrolnymi (ostatnie dotyczy tylko projektów brownfield):

1. Access control — czy wiesz, kto ma do czego dostęp?

2. Business logic — czy masz jednozdaniową regułę biznesową?

3. Project artifacts — czy notatki z sesji są zapisane?

4. Koszt czasu — czy pierwszy przepływ mieści się w trzech tygodniach pracy po godzinach, a jeśli nie, czy świadomie przyjąłeś dłuższy timeline?

5. Non-goals — czy wiesz, czego *nie* budujesz?

6. Zachowanie istniejących funkcji *(tylko brownfield)* — czy jest jasno napisane, co nie może przestać działać?

Jeżeli gdziekolwiek będą luki, AI wskaże gdzie brakuje ci jeszcze odpowiedzi.

Twoja rola w całej sesji to odpowiadać konkretnie, także wtedy, gdy uczciwa odpowiedź brzmi "nie wiem".

### Demonstracja sesji

Zobaczmy jak to wygląda w praktyce:

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1192850360" title="Odtwarzacz wideo Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>

### Po sesji planistycznej

Wynik naszej pracy to **shape-notes.md**: zapis decyzji, nie zapis rozmowy.

To już jest materiał, z którym **/10x-prd** może pracować. Nie gotowa aplikacja, ale wystarczająca baza do kontraktu.

Czy to wolniejsze niż wejście prosto w kod? Przez pierwszą godzinę, tak. Ale dzięki temu zaoszczędzisz ogrom czasu, który zmarnowałbyś na kodowanie rzeczy, których nie potrafiłeś konkretnie opisać.

## Krok drugi: generacja PRD przez /10x-prd

Drugi krok to wygenerowanie PRD z notatek:

```
/10x-prd @context/foundation/shape-notes.md
```

**/10x-prd** domyślnie czyta **context/foundation/shape-notes.md** i tworzy plik **context/foundation/prd.md**. Robi jedną rzecz: zapisuje twoje decyzje w stałej strukturze, żeby kolejne agentowe kroki miały skąd je czytać.

PRD opisuje produkt i biznes, nie technologię. W środku znajdziesz wizję, personę, kryteria sukcesu, user stories, wymagania funkcjonalne, regułę biznesową, kontrolę dostępu, jawne non-goals i listę otwartych pytań. Modelu danych tam nie ma celowo — encje wynikają z wymagań i user stories, a przypina się je dopiero na etapie wyboru stacku. Jeśli w notatkach opisałeś dane, skill przekaże to dalej, zamiast wyrzucić.

Tech stack, plan testów i deployment celowo nie są w PRD. Wpadną do dalszych skilli, które konsumują PRD jako wejście.

### Ostrzeżenie przed PRD widmo

Jest jedna sytuacja, w której **/10x-prd** da Ci wyraźny sygnał, że coś jest nie w porządku - gdy **shape-notes.md** ma za mało konkretów.

Skill sprawdza notatki pod kątem czterech sygnałów: checkpoint, wymagania w formacie FR-NNN, user stories ze strukturą Given/When/Then, reguła biznesowa.

Jeśli zabraknie zbyt wielu, dostajesz ostrzeżenie z konkretnymi brakami i propozycją powrotu do **/10x-shape**. Jeżeli sumiennie przejdziesz przez sesję planistyczną z **/10x-shape**, nie powinno to mieć miejsca.

### Kontrola po wygenerowaniu PRD

Otwórz **prd.md** i odpowiedz sobie:

- Czy widzisz jednego konkretnego użytkownika, nie "developera ogółem"?

- Czy pierwszy przepływ da się przejść od początku do końca w trzech tygodniach pracy po godzinach — a jeśli nie, czy świadomie bierzesz dłuższy timeline na siebie? (Trzy tygodnie to realia pracy po godzinach, nie warunek dopuszczenia projektu.)

- Czy logika biznesowa to konkretna reguła, a nie "user dodaje rekordy"?

- Czy są jawne non-goals, czy tylko "zostawiamy na potem"?

- Czy **## Open Questions** jest pusta albo zawiera tylko naprawdę otwarte rzeczy?

Jeśli któraś odpowiedź cię niepokoi, edytujesz dokument lub wracasz do **/10x-shape**. To ważne, aby ten fundament był solidny - będziemy na nim rozwijali cały projekt.

## Praca z istniejącym projektem i kolejnymi zmianami

Oba skille potrafią też pracować w trybie brownfield. Jeśli uruchomisz **/10x-shape** w katalogu istniejącego projektu (tam, gdzie leży **package.json**, **Cargo.toml** czy inny marker), skill wykryje ten kontekst i zaproponuje przełączenie na sesję brownfield. Zamiast pytać "co budujesz od zera", pyta "co chciałbyś dodać/poprawić w systemie?". Poniżej przejdziemy przez ten wariant pracy.

### Brownfield: sesja na istniejącym projekcie

Nie każdy kursant startuje od zera. Jeśli twój projekt kursowy to zmiana w istniejącym systemie (nowy moduł w side-projectcie, rozbudowa narzędzia z pracy, refaktor kluczowego przepływu), workflow shape/prd działa tak samo, ale **/10x-shape** przełącza się na tryb brownfield.

W praktyce: uruchamiasz **/10x-shape** w katalogu istniejącego projektu. Skill wykrywa markery (**package.json**, **tsconfig.json**, **Cargo.toml**, **go.mod** itp.), proponuje tryb brownfield i czeka na twoje potwierdzenie. Możesz też ręcznie przełączyć tryb, jeśli auto-detekcja nie trafiła.

Te same sześć faz, ale pytania przesuwają się z "co budujesz od zera" na "co zmieniasz w tym, co już masz":

- **Vision & problem** — co jest dzisiaj, co boli i dlaczego teraz (zamiast "kto ma problem z niczego").

- **Persona & access control** — jak wygląda obecne uwierzytelnianie i kto ma jakie role (zamiast projektowania auth od zera).

- **MVP discipline** — jaka jest najmniejsza zmiana, która udowodni poprawę, i jaki jest jej blast radius. Zamiast "MVP-in-three-weeks" od pustego projektu: delta, którą da się dowieźć i zweryfikować.

- **FRs & user stories** — wymagania kategoryzowane jako nowe, zmodyfikowane lub zachowane (zamiast traktowania wszystkiego jako nowe).

- **Business logic & data** — czy ta zmiana dodaje nową regułę domenową, modyfikuje istniejącą, czy to zmiana infrastrukturalna.

- **Product framing** — czy zmienia się typ produktu, skala, ograniczenia (bramki tak/nie zamiast pełnej klasyfikacji od zera).

Na koniec sesji **shape-notes.md** zawiera dwie sekcje, których greenfield nie ma: **## Current System** (opis tego, co istnieje) i **## Constraints & Preserved Behavior** (co musi zostać nienaruszone).

### PRD dla istniejącego projektu

Kluczowa różnica: greenfield PRD opisuje cały produkt od zera. Brownfield PRD opisuje deltę: co jest dzisiaj, co się zmienia, co musi zostać.

### Nie tylko na start projektu

Ten workflow to nie rytuał inicjacyjny (no może trochę!). Powinien stać się nowym nawykiem przy rozpoczynaniu większych inicjatyw.

Często ludzie odpalają skille w stylu **/10x-shape** raz, na starcie projektu, i potem wracają do starego trybu: prosto do kodu. Tydzień później dodają nowy moduł, integrację albo poważną zmianę przepływu, a Agent nie ma żadnego kontraktu do tych zmian.

Kiedy za dwa tygodnie będziesz dodawać nowy moduł, zrób miniwersję tej samej sesji. Czasem wystarczy krótki shape pod konkretną funkcję zamiast pełnego PRD.

Zasada zostaje: zanim Agent zacznie edytować pliki, musi wiedzieć, jaki problem rozwiązujemy i po czym poznamy, że praca jest skończona.

## 🧑🏻‍💻 Zadania praktyczne

Zanim przejdziesz do drugiej lekcji, przejdź pełny cykl na własnym pomyśle lub projekcie. Zacznij od pobrania materiałów do lekcji:

```
npx @przeprogramowani/10x-cli@latest auth
npx @przeprogramowani/10x-cli@latest get m1l1
```

Jeśli nadal wahasz się nad pomysłem, uruchom **/10x-idea-check**. Opisz pomysł, swoje doświadczenie z programowaniem i z agentami oraz dostępny czas i wybrany termin. Przeczytaj rekomendację i wybierz następny krok. Jeśli masz już wybrany kierunek, przejdź od razu do inicjalizacji i sesji **/10x-shape**. Wyniku idea checku nie oddajesz i nie musisz mieć pozytywnej rekomendacji, żeby ukończyć lekcję.

👉 Zacznij od inicjalizacji folderu **/context** w Twoim projekcie za pomocą skilla **/10x-init**.

Następnie:

- **Greenfield** (działasz na nowym projekcie) - Wywoła&#x6A;**/10x-shape** przekazując Twój mętny pomysł na aplikację jako wejście (kopiuj-wklej lub referencja do pliku). Przejdź sesję planistyczną z agentem, tak aby powstało **shape-notes.md**. Następnie wywołaj **/10x-prd** i sprawdź, czy PRD ma określonego użytkownika, rozwiązywany problem, pierwszy przepływ do zrealizowania, opis logiki biznesowej, granice MVP, jawne non-goals i kryteria sukcesu.

- **Brownfield** (zmieniasz istniejący projekt) - Wywołaj **/10x-shape** w roocie projektu i przekaż mętny pomysł na wprowadzenie zmian w projekcie. Skill zaproponuje tryb brownfield; potwierdź i przejdź sesję skupioną na bólu obecnego systemu i najmniejszej wartościowej zmianie. **/10x-prd** wygeneruje brownfield PRD z opisem obecnego systemu, zakresem zmiany i ograniczeniami kompatybilności.

Po zakończeniu pracy powinieneś mieć dwa pliki w **context/foundation/**: **shape-notes.md** z sesji **/10x-shape** i **prd.md** wygenerowany przez **/10x-prd**.

### Co dalej z przygotowanym PRD?

W kolejnej lekcji (M1L2) zajrzymy pod maskę skilli i wykorzystamy PRD do wyboru tech stacku pod konkretny problem, a nie pod modę.

W lekcji trzeciej (M1L3), PRD wraz z wybranym stackiem trafiają do bootstrapu projektu. To lekcja, w której zamienimy kontrakty w konkretne pliki.

Jeśli zaczynałeś od **/10x-idea-check**, to był krok zerowy — opcjonalny i poza tym ciągiem. Workflow **/10x-shape → /10x-prd → wybór stacku → bootstrap** rozkłada się na trzy lekcje, ale to jeden ciąg. Jeśli pierwszy kontrakt jest pusty, reszta będzie tylko szybszym sposobem dowożenia złych decyzji.

Szybciej nie zawsze znaczy lepiej. Czasem znaczy po prostu... szybciej w złym kierunku.

Rozwijając istniejący projekt, w kolejnych lekcjach będziesz oceniać swój stack (zamiast wybierać nowy), a w lekcji o bootstrapie robić health-check projektu (zamiast go stawiać od zera). Brownfield PRD będzie kontraktem wejściowym dla tych kroków, tak jak greenfield PRD jest kontraktem wejściowym dla wyboru stacku technoliczinego i bootstrapu.

## Odbierz swoją odznakę

Po ukończeniu tej lekcji odbierz odznakę w sekcji [10xDevs Mission Log](https://platforma.przeprogramowani.pl/mission-log) a następnie pochwal się swoim osiągnięciem!

## 🔎 Deep Dive

Ta sekcja zawiera dodatkowe pogłębienie wiedzy na temat wybranych zagadnień związanych z lekcją. W tym Deep Dive znajdziesz:

- **Jakie modele i narzędzia wybrać** — konkretne rekomendacje modeli, subskrypcji i narzędzi do pracy z agentem w Module 1

Ta sekcja lekcji nie jest obowiązkowa, ale warto się z nią zapoznać jeżeli chcesz zostać ekspertem.

### Jakie modele i narzędzia wybrać

Żeby uruchomić **/10x-shape**, potrzebujesz agenta AI z dostępem do modelu językowego. Na rynku jest ponad sto modeli i kilkanaście narzędzi. Poniżej konkretne rekomendacje zamiast przeglądu całego rynku.

**Najprostsza ścieżka: pierwsza płatna subskrypcja**

Zacznijmy od rzeczy, której nie da się dziś obejść: **darmowa praca z agentem to mrzonka.** Darmowe tiery albo zniknęły, albo płacisz w nich swoimi promptami i kodem — a tego akurat nie chcemy. Pierwsza płatna subskrypcja u jednego dostawcy to najprostszy sposób, żeby w ogóle wejść do tej pracy.

Reguła jest prosta: **wybierz jednego dostawcę i kup u niego najniższy plan, na który cię stać.** Wyższy rozważ dopiero wtedy, gdy zaczniesz odbijać się od limitów.

Za **$20/mies.** kupujesz plan — **Claude Pro** u Anthropic albo **ChatGPT Plus** u OpenAI — a w nim dostęp do modeli wystarczających do codziennej pracy. Anthropic nie przypisuje przy tym konkretnej wersji modelu do planu, tylko całe rodziny: w Pro masz **Opusa** i **Sonneta** w zwykłym limicie, a **Fable'a** wyłącznie na osobnych kredytach (*usage credits*). Wystarczy do sesji **/10x-shape**, generowania PRD i większości zadań z Modułu 1.

Za tę samą kwotę możesz też kupić [**Cursor Pro**](https://cursor.com/pricing) — **$20/mies.** z rozszerzonymi limitami agenta, dostępem do modeli frontierowych i do Composera. To opcja dla osób, które wolą pracować w IDE niż w terminalu. Darmowy plan Hobby ma limity agenta na tyle ciasne, że do zadań z tego modułu nie wystarczy — i to kolejny dowód na to, że wejście „za $0” dziś nie istnieje.

Za **$100/mies.** wchodzisz na wyższy plan — **Claude Max 5x** u Anthropic albo **ChatGPT Pro** u OpenAI — z tymi samymi rodzinami modeli, ale wyższymi limitami. Najważniejsza różnica względem Pro: **Fable**, najmocniejsza rodzina Anthropic, wchodzi tu w **zwykłe zużycie** — do 50% tygodniowego limitu, bez dokupowania kredytów. To dlatego Max 5x jest naszym planem na codzień. Ma sens, jeśli chcesz dużo pracować z tymi narzędziami i zależy ci na jakości rozumowania bez martwienia się o rachunki API i limity.

**Uwaga na moment, w którym to czytasz:** przejście na **ChatGPT Pro** jest w tej chwili zablokowane. Popyt, jaki wywołała **Astra**, przekroczył moce OpenAI i sprzedaż wyższego planu została wstrzymana. Jeśli Pro jest u ciebie niedostępne, zostaje Plus albo dostęp przez API. Dostępność planów zmienia się dziś w tygodniach, nie w miesiącach, więc zamiast wierzyć tej lekcji na słowo, sprawdzaj źródła u samego dostawcy — np. [Tibo Sottiaux](https://x.com/thsottiaux) z OpenAI na X.

**Jeśli $20 miesięcznie to dla ciebie za dużo**

Jest tańszy szczebel niż Claude Pro i ChatGPT Plus — i nadal nie jest to szczebel „za darmo”:

- [**OpenCode Go**](https://opencode.ai/pl/go) — **$10/mies.** za subskrypcję z hojnymi limitami i zestawem 27 modeli dobranych pod kodowanie z agentem (m.in. DeepSeek V4 Flash, Qwen3.7 Plus, GLM-5.3-Flash, GPT-5.6 Luna, MiniMax M3). Gdy limit się skończy, doładowujesz konto. To najtańsze sensowne wejście, jakie dziś znamy.
- [**OpenCode Zen**](https://opencode.ai/pl/zen) — bez abonamentu: płacisz za żądanie z przedpłaconego salda (start od **$20**, auto-doładowanie przy $5). Modele są wyselekcjonowane i przebenchmarkowane pod agentów kodujących, hostowane w USA, z zerową retencją i bez trenowania na twoich danych. Działa z dowolnym agentem, nie tylko z OpenCode.

Różnica między nimi jest prosta: **Go to przewidywalny rachunek, Zen to przewidywalna jakość przy płatności za zużycie.**

Jest jeszcze jeden argument za subskrypcją, który nie jest oczywisty na starcie: **przy aktywnym kodowaniu z AI koszty przez API kumulują się szybko.** Jedna sesja **/10x-shape** to kilkadziesiąt tysięcy tokenów. Pełny dzień pracy z agentem to miliony tokenów.

Nawet przy tanich chińskich modelach miesięczny rachunek potrafi przekroczyć $20–50 szybciej, niż myślisz. A przy modelach premium wystarczy kilka intensywnych dni, żeby subskrypcja za $100 okazała się tańsza niż płacenie za tokeny.

Przewidywalny koszt i brak liczenia tokenów to wartość sama w sobie, gdy chcesz się skupić na pracy. W praktyce **ta sama kwota wydana na subskrypcję starcza zwykle na więcej pracy niż wydana przez API** — dostawcy wliczają w plan limity, które przy rozliczeniu za tokeny musiałbyś kupić osobno.

Stąd taka, a nie odwrotna kolejność rekomendacji: najpierw subskrypcja, API dopiero wtedy, gdy subskrypcja przestaje wystarczać albo świadomie chcesz mieszać modele wielu dostawców.

**Z czego my korzystamy?**

Nasza praca wymaga od nas testowania różnych subskrypcji z topowymi modelami, więc na bieżąco siedzimy i na **Claude Max 5x** ($100/mies.) z modelem **Fable 5.1**, i na **ChatGPT Pro** z **GPT-6 Astra**. **Tobie wystarczy jeden z nich** — nie kupuj dwóch planów, bo my tak robimy.

Oba uważamy za równie użyteczne, ale inaczej: Fable idzie wolniej i rozumuje lepiej, Astra oddaje wynik szybciej. Wybierz ten, który lepiej pasuje do twojego stylu pracy.

Jedno zastrzeżenie, bo jest ważniejsze niż sam wybór marki: **żadnego z nich nie używamy jako silnika do całej codziennej roboty.** Są na to za drogie. Sięgamy po nie do planowania strategicznego i do kodowania w miejscach krytycznych — a rutynę zlecają dalej, o czym za chwilę.

**Model to tylko jedno z trzech pokręteł**

Zanim przejdziemy do tabelki z cenami, jedna rzecz, która zmienia sposób czytania takich tabelek. Na wynik i na rachunek wpływają dziś trzy niezależne pokrętła:

1. **Wybór modelu** — o tym jest ta sekcja.
2. **Poziom rozumowania** (*reasoning effort*) — ile model myśli, zanim odpowie.
3. **Topologia delegowania** — kto komu zleca pracę. O tym w następnej sekcji.

Poziom rozumowania to suwak ustawiany per zapytanie. W modelach Anthropic ma pięć pozycji: **low**, **medium**, **high**, **xhigh**, **max**. Domyślnie stoi na **high**, a Claude Code do zadań kodujących i agentowych podnosi go do **xhigh**. Im wyżej, tym więcej tokenów i tym dłużej trwa odpowiedź, ale tym lepsze wyniki na trudnych problemach. Im niżej, tym mniej preambuły, mniej wywołań narzędzi i krótsze potwierdzenia.

Dwie konsekwencje warto zapamiętać, bo obie są kontrintuicyjne:

- **Ten sam model na niższym efforcie bywa radykalnie tańszy przy porównywalnej jakości.** Zejście z **max** na **high** to rząd jednej trzeciej kosztu za zadanie przy stracie dwóch punktów w indeksie inteligencji. Bez zmiany modelu.
- **Niższy effort na nowszym modelu często bije wysoki effort na starszym.** Dlatego „weź starszy model, bo tańszy" przestało być dobrą heurystyką — a była nią jeszcze rok temu.

Praktyczny wniosek: zanim zbudujesz kaskadę z trzech różnych modeli, sprawdź najpierw **najmocniejszy model na niższym efforcie**. Jeden model to również jedna przestrzeń cache'u — kaskada traci współdzielenie cache'u między modelami, co przy dłuższych sesjach potrafi zjeść całą oszczędność.

Sam suwak widziałeś już w preworku, tylko z innej strony — jako ustawienie w narzędziu: Prework [\[2.2\]](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/05) *Cursor — Podstawy operacyjne* i [\[2.3\]](https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/06) *Claude Code — Podstawy operacyjne*. Tutaj patrzymy na niego jako na dźwignię kosztową.

**Architekci i implementatorzy**

Nie wszystkie modele nadają się do tych samych zadań.

Przetestowaliśmy 22 modele na benchmarku kodowania: pełna implementacja feature'u z bazą danych, frontendem i testami. Z tego testu został z nami jeden wniosek, który jest trwalszy niż każdy konkretny ranking: **cena za milion tokenów nie wystarcza, żeby porównać modele.**

Model droższy za token, ale kończący zadanie w mniejszej liczbie kroków, bywa w sumie tańszy od „taniego" modelu, który rozumuje długo i zapętla się na narzędziach. Porównując same stawki, porównujesz jabłka z pomarańczami. Sensowna jednostka to **koszt za ukończone zadanie**.

Widać to w publicznych danych [Artificial Analysis](https://artificialanalysis.ai/leaderboards/models) — przy **tym samym** wyniku w indeksie inteligencji:

- **Model**: GPT-6 Astra (effort **xhigh**) | **Indeks**: 53 | **Koszt / zadanie**: $2.31
- **Model**: Claude Fable 5.1 (effort **xhigh**) | **Indeks**: 53 | **Koszt / zadanie**: $5.98
- **Model**: GPT-6 Astra (effort **medium**) | **Indeks**: 50 | **Koszt / zadanie**: $1.54
- **Model**: Claude Fable 5 | **Indeks**: 50 | **Koszt / zadanie**: $8.75
- **Model**: Claude Fable 5.1 (effort **high**) | **Indeks**: 51 | **Koszt / zadanie**: $3.91
- **Model**: Claude Opus 5 (effort **max**) | **Indeks**: 51 | **Koszt / zadanie**: $5.86

Dwa ostatnie wiersze to cała lekcja o efforcie w miniaturze: **ten sam model** na niższym suwaku oddaje dwa punkty indeksu za jedną trzecią kosztu.

Ale to benchmark *implementacyjny*. W zadaniach analitycznych, takich jak prowadzenie sesji planistycznej czy rozumowanie o architekturze, topowe modele mają przewagę, której benchmark kodowania nie uchwyci.

To prowadzi do podziału, który będzie motywem przewodnim kursu — ale uwaga, **nie** jest to podział „drogi model myśli, tani model klepie kod". Ta wersja była prawdziwa rok temu. Dziś najmocniejsze modele wygrywają również benchmarki implementacyjne, więc różnica nie leży w tym, *co* model potrafi, ale w tym, *ile razy* chcesz mu za to zapłacić.

Sam podział zostaje i nadal jest użyteczny. Zmieniło się to, co robi jego górna połowa — architekt przestał być tylko autorem planu, a stał się też jego wykonawcą przez delegowanie:

- **Architekci / myśliciele** — Fable, Opus, GPT-6 Astra, GPT-5.6 Sol, Kimi K3. Analiza, planowanie, rozumowanie wielokrokowe. Droższe, ale w zadaniach wymagających myślenia nie mają sensownych zamienników. Do tego doszła im **nowa specjalizacja: zarządzanie subagentami**. Architekt nie musi pisać każdej linii sam — rozbija zadanie, powołuje subagentów na tańszych modelach, rozdaje im pracę i weryfikuje to, co wróciło.

- **Implementatorzy** — Claude Opus 5, GPT-5.6 Sol, GPT-5.6 Luna, GLM-5.3, Gemini 3.8 Flash, Composer 2.5, Grok 4.6. Doskonały stosunek ceny do jakości kodu. Ten podział mówi o **typie zadania, jakie model dostaje na wejściu**, a nie o tym, kto mu je podaje: implementator równie dobrze odbiera wąskie, dobrze opisane zadanie od ciebie w nowej sesji, jak i od innego modelu.

- **Podłoga kosztowa** — DeepSeek V4.1 Flash, GLM-5.3 Flash, Qwen 3.8, MiniMax M3. Jeśli budżet jest naprawdę ciasny albo chcesz eksperymentować na dużą skalę, tu są najtańsze tokeny na rynku. Uwaga: **darmowe tiery na OpenRouterze zniknęły** — o tym niżej.

Orientacyjne ceny na [OpenRouter](https://openrouter.ai/models) (wrzesień 2026, za milion tokenów). Czytaj je razem z poprzednią sekcją — sama stawka za token nie mówi, ile zapłacisz za ukończone zadanie:

- **Model**: [Claude Opus 5](https://openrouter.ai/anthropic/claude-opus-5) | **Rola**: Oba | **Input / Output**: $5.00 / $25.00 | **Kontekst**: 1M | **Uwagi**: nasz domyślny subagent

- **Model**: [Claude Fable 5.1](https://openrouter.ai/anthropic/claude-fable-5.1) | **Rola**: Architekt | **Input / Output**: $10.00 / $50.00 | **Kontekst**: 1M | **Uwagi**: najmocniejszy model Anthropic, nasz wybór do planowania

- **Model**: [Claude Sonnet 5](https://openrouter.ai/anthropic/claude-sonnet-5) | **Rola**: Implementator | **Input / Output**: $2.00 / $10.00 | **Kontekst**: 1M | **Uwagi**: najlepszy stosunek ceny do jakości w rodzinie Claude

- **Model**: [Gemini 3.8 Flash](https://openrouter.ai/google/gemini-3.8-flash) | **Rola**: Implementator | **Input / Output**: $0.75 / $3.75 | **Kontekst**: 1M | **Uwagi**: cena promocyjna do 31.12.2026, potem dwa razy wyżej

- **Model**: [GPT-6 Astra](https://openrouter.ai/openai/gpt-6-astra) | **Rola**: Architekt | **Input / Output**: $10.00 / $50.00 | **Kontekst**: 1.05M | **Uwagi**: flagowy model OpenAI; powyżej 272K tokenów input liczy się podwójnie

- **Model**: [GPT-5.6 Sol](https://openrouter.ai/openai/gpt-5.6-sol) | **Rola**: Oba | **Input / Output**: $4.00 / $20.00 | **Kontekst**: 1.05M | **Uwagi**: model kodujący OpenAI

- **Model**: [GPT-5.6 Luna](https://openrouter.ai/openai/gpt-5.6-luna) | **Rola**: Implementator | **Input / Output**: $0.20 / $1.20 | **Kontekst**: 1.05M | **Uwagi**: tani i szybki subagent

- **Model**: [DeepSeek V4.1 Flash](https://openrouter.ai/deepseek/deepseek-v4.1-flash) | **Rola**: Podłoga kosztowa | **Input / Output**: $0.15 / $0.60 | **Kontekst**: 1.05M | **Uwagi**: nowa architektura CED, output do 384K

- **Model**: [Qwen 3.8 Max](https://openrouter.ai/qwen/qwen3.8-max) | **Rola**: Podłoga kosztowa | **Input / Output**: $2.00 / $6.00 | **Kontekst**: 1M | **Uwagi**: 2,4 bln parametrów MoE, przyjmuje tekst, obraz i wideo

- **Model**: [MiniMax M3](https://openrouter.ai/minimax/minimax-m3) | **Rola**: Podłoga kosztowa | **Input / Output**: $0.23 / $0.96 | **Kontekst**: 1.05M | **Uwagi**: open-weight, multimodalny

- **Model**: [DeepSeek V4 Pro 0813](https://openrouter.ai/deepseek/deepseek-v4-pro) | **Rola**: Podłoga kosztowa | **Input / Output**: $0.58 / $1.73 | **Kontekst**: 1.05M | **Uwagi**: mocniejszy brat V4.1 Flash

- **Model**: [GLM-5.3](https://openrouter.ai/z-ai/glm-5.3) | **Rola**: Implementator | **Input / Output**: $0.87 / $3.36 | **Kontekst**: 200K | **Uwagi**: czwarte miejsce na Terminal-Bench 4.0, najmocniejszy model spoza USA

- **Model**: [Kimi K3](https://openrouter.ai/moonshotai/kimi-k3) | **Rola**: Architekt | **Input / Output**: $2.80 / $14.00 | **Kontekst**: 1.05M | **Uwagi**: Moonshot AI, 2,8 bln parametrów, otwarte wagi; ceny wahają się między dostawcami

- **Model**: [Grok 4.6](https://openrouter.ai/x-ai/grok-4.6) | **Rola**: Implementator | **Input / Output**: $2.00 / $6.00, powyżej 200K $4.00 / $12.00 | **Kontekst**: 500K | **Uwagi**: xAI; wyższa stawka obejmuje **cały** request, ale cache kosztuje $0.50

- **Model**: Composer 2.5 (tylko w [Cursorze](https://cursor.com/), nie ma go na OpenRouterze) | **Rola**: Implementator | **Input / Output**: $0.50 / $2.50, tryb Fast $3.00 / $15.00 | **Kontekst**: 1M | **Uwagi**: model Cursora na bazie Kimi K2.5; **Fast jest domyślny**, więc łatwo przepłacić

- **Model**: [Muse Spark 1.3](https://openrouter.ai/meta/muse-spark-1.3) | **Rola**: Oba | **Input / Output**: $1.25 / $4.25 | **Kontekst**: 1M | **Uwagi**: Meta; tier Contributor kosztuje $0.10 / $0.20, ale Meta trenuje na twoich promptach

Ceny zmieniają się dynamicznie, traktuj tabelę jako punkt orientacyjny. Aktualny cennik sprawdzaj na [openrouter.ai/models](https://openrouter.ai/models).

Jedna zmiana, o której warto wiedzieć, jeśli pamiętasz wcześniejsze edycje kursu: **darmowe tiery na OpenRouterze praktycznie zniknęły.** DeepSeek, Qwen, GLM i Hy3 nie mają już wariantów **:free**. Wejście „za $0" przestało istnieć w tej formie.

Zostały dwie ścieżki bliskie zeru, obie z tym samym haczykiem:

- **Muse Spark 1.3 Contributor** — $0.10 / $0.20 za milion tokenów, ale Meta trenuje na twoich promptach i odpowiedziach.
- **Darmowy tier API Gemini** — bez opłat, ale Google wykorzystuje dane do rozwoju produktu.

Innymi słowy: **darmowa praca z AI jest dziś mrzonką** — najtańsza ścieżka nie jest darmowa, tylko **płatna danymi**. Dla kodu, który piszesz w pracy, to zwykle cena nie do przyjęcia i my jej nie płacimy. To dokładnie ten kompromis, który rozbieramy w lekcji o bezpiecznej pracy z agentem (M1L3) — zanim wyślesz tam kod firmowy, przeczytaj tamtą sekcję o jurysdykcji danych.

**Praktyczna sztuczka: osobny model dla subagentów**

Skoro architekt potrafi delegować, to warto rozdzielić model, którym *myśli*, od modelu, którym *wykonuje*. Claude Code czyta zmienną **CLAUDE\_CODE\_SUBAGENT\_MODEL** — to domyślny model dla subagentów, teammate'ów w agent teamach i agentów w workflow, o ile nie dostali modelu w inny sposób. Przyjmuje alias (np. **haiku**) albo pełną nazwę modelu.

Dlaczego to się opłaca: model orkiestrujący chętnie powołuje subagentów, ale większość zleconej im pracy nie wymaga rozumowania na najwyższym poziomie. Ustawienie subagentom **Opusa** zamiast **Fable'a** potrafi więc wyraźnie wydłużyć twój tygodniowy limit przy tej samej jakości efektu końcowego. To dziś jedna z częściej polecanych optymalizacji w społeczności.

Jedna pułapka: model podany per wywołanie albo w definicji agenta (pole **model**, łącznie z wartością **inherit**) ma **wyższy priorytet** niż ta zmienna. Jeśli chcesz wymusić swoje ustawienie ponad definicjami, użyj **CLAUDE\_CODE\_SUBAGENT\_MODEL\_FORCE**.

**W Module 1 potrzebujesz architektów.** Sesje **/10x-shape**, generowanie PRD, analiza stacku, planowanie. To zadania, w których liczy się jakość rozumowania.

**W Module 2 pokażemy pętlę z implementatorami.** Architekt planuje, implementator koduje. Delegowanie implementacji do tańszych modeli to osobny temat. Na razie zapamiętaj, że istnieją modele kodujące na poziomie premium za ułamek ceny.

**Wariant awaryjny: OpenRouter + OpenCode (BYOK)**

Jeśli żadna subskrypcja nie wchodzi w grę — bo plan jest u ciebie niedostępny, bo nie chcesz abonamentu albo bo musisz mieszać modele wielu dostawców — zostaje płatność za zużycie. [**OpenRouter**](https://openrouter.ai/) daje dostęp do ponad stu modeli z jednego klucza API. Rejestrujesz się, doładowujesz konto i korzystasz z modeli z tabelki wyżej, a ten sam klucz podepniesz do dowolnego agenta (BYOK — *bring your own key*).

[**OpenCode**](https://opencode.ai/) to otwartoźródłowy agent CLI z ponad 200 tysiącami gwiazdek na GitHubie. Działa z dowolnym dostawcą modeli: OpenRouter, Anthropic, OpenAI, lokalne modele przez Ollama. Od sierpnia 2026 ma realną konkurencję — DeepSeek wypuścił własny harness i dogonił OpenCode w gwiazdkach w dwa tygodnie.

Nasz benchmark kodowania (22 modele) był przeprowadzony właśnie na OpenCode z modelami przez OpenRouter. Te wyniki nie są teoretyczne.

Ta ścieżka wymaga więcej konfiguracji na start, ale daje pełną kontrolę nad kosztami i dostęp do tanich modeli, które dobrze sprawdzają się w roli wykonawców. Jeśli twój budżet jest ograniczony, chcesz eksperymentować albo zależy ci na prywatności (OpenCode nie przechowuje twojego kodu), warto rozważyć ten wariant.

**Testuj na swoich zadaniach**

Nasze dane to jeden benchmark, jedno zadanie. Twój projekt i twoje preferencje mogą dać inne wyniki.

Wypróbuj 2–3 modele na własnym projekcie, zanim zdecydujesz na stałe. Sprawdź, jak model radzi sobie z **/10x-shape** na twoim konkretnym pomyśle. To najlepszy test, jaki możesz przeprowadzić.

## 📚 Materiały dodatkowe

- [What is a Product Requirements Document?](https://www.atlassian.com/agile/product-management/requirements) — Atlassian

- [Towards a question-answering model for requirements elicitation](https://link.springer.com/article/10.1007/s10515-023-00386-w) — QUARE

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) — Anthropic

- [Prompting fundamentals](https://openai.com/academy/prompting/) — OpenAI Academy

- [About GitHub Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent) — GitHub Docs

- [OpenRouter](https://openrouter.ai/) — brama do 100+ modeli AI z jednego klucza API

- [OpenCode](https://opencode.ai/) — otwartoźródłowy agent CLI do kodowania z AI

- [OpenRouter + OpenCode quickstart guide](https://openrouter.ai/docs/cookbook/coding-agents/opencode-integration) — integracja OpenRouter z OpenCode
