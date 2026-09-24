---
title: "Od roadmapy do kodu: plan, review, implementacja"
course: "10xdevs-4"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-09-24"
format: "markdown"
---

![Obraz 1](https://images.przeprogramowani.pl/cms/9f594793-a023-4923-86d4-c23af2ae661e/8d59874d375ad4ddadaf19aca4a799964833a8a54ebf77f73572b6741ca39127.jpg)

W poprzedniej lekcji zbudowaliśmy roadmapę MVP - mapę pracy dla człowieka i agenta. Pozwala zrozumieć, co jest fundamentem projektu, co jest pionowym slice'em funkcjonalnym, co jest zablokowane, co można robić równolegle i co świadomie trafia na parking.

Masz roadmapę, widzisz kilka pozycji ze statusem **ready**, więc odpalasz agenta i piszesz: „zrób teraz cały Stream A”. Agent czyta pliki, układa sobie plan i modyfikuje kilkanaście miejsc naraz.

Po chwili coś działa, coś wygląda na prawie gotowe, coś jest tylko obietnicą w komentarzu, a ty próbujesz zrekonstruować, co właściwie było celem tej sesji.

Czyli wracamy do starego problemu, tylko na wyższym poziomie. Zamiast promptu „zbuduj MVP” mamy prompt „zbuduj stream”. Brzmi profesjonalniej, ale nadal jest za szerokie.

W tej lekcji robimy następny krok. Bierzemy roadmapę i zamieniamy ją w pierwszy kontrolowany cykl pracy:

```
roadmap item -> change-id -> plan.md -> plan review -> implementacja fazy -> Progress
```

Plan pozwala ci ocenić zamierzenia agenta, zanim zacznie zmieniać kod. Agent zapisuje w nim założenia, fazy, modyfikacje kontraktu i warunki zakończenia pracy. Wtedy możesz powiedzieć: „tak, to ma sens” albo „nie, zatrzymajmy się tutaj”.

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1193150555" title="Odtwarzacz wideo Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>

### Roadmapa jako mapa streamów

Najpierw pobierz paczkę artefaktów dla tej lekcji:

```
npx @przeprogramowani/10x-cli@latest get m2l2
```

Ta paczka dostarcza workflow potrzebny w tej lekcji: **/10x-new**, **/10x-plan**, **/10x-plan-review** i **/10x-implement**.

Punktem startowym jest **context/foundation/roadmap.md**, który utworzyliśmy w poprzedniej lekcji. Znajdziesz w nim zależności między zadaniami i podział na strumienie pracy, które pomagają wybrać następne zadanie.

Dla naszego przykładowego projektu 10xCards najważniejszy jest teraz Stream A, czyli ścieżka od minimalnego zarysu produktu do pierwszego działającego przepływu generowania i zapisywania fiszek.

W uproszczeniu wygląda to tak:

![Obraz 1](https://images.przeprogramowani.pl/diagrams/lessons-m2-l2-lesson-draft-1-10x.png)

W tej lekcji interesuje nas główny tor generowania i zapisywania kart:

- **F-01** jako podstawa techniczna, która porządkuje dostęp do produktu.

- **S-01** jako pierwszy zabezpieczony cykl generowania kart.

- **S-02** jako zapis zaakceptowanych kart do decku.

- opcjonalnie **S-03** jako kontynuacja, jeśli demo i czas na to pozwolą.

**S-04**, czyli sesja powtórek w stylu spaced repetition, wymaga najpierw wyboru biblioteki, ustalenia modelu **ReviewState**, skali ocen i polityki edycji kart. Dlatego zajmiemy się nim później.

**S-05** z obszaru compliance też zostawiamy na później. W tej lekcji skupiamy się na przejściu od roadmapy do pierwszego działającego streamu.

### Zakres tej lekcji

W tej lekcji przejdziemy z fragmentem roadmapy od planu do implementacji, z podziałem na fazy i weryfikacją wyniku.

Całe 10xCards, wybór biblioteki SRS i pełne review wygenerowanego kodu wykraczają poza zakres tej lekcji.

Wybieramy zadania, których zakres dobrze rozumiemy i z którymi możemy szybko ruszyć. Przejdziemy z nimi przez workflow **plan -> implement**.

- **Roadmap item**: **F-01** | **Rola w lekcji**: podstawa techniczna | **Co z nim robimy**: szybki plan i do dzieła

- **Roadmap item**: **S-01** | **Rola w lekcji**: slice funkcjonalny 1 | **Co z nim robimy**: planujemy i implementujemy

- **Roadmap item**: **S-02** | **Rola w lekcji**: slice funkcjonalny 2 | **Co z nim robimy**: planujemy i implementujemy

- **Roadmap item**: **S-03** | **Rola w lekcji**: slice funkcjonalny 3 | **Co z nim robimy**: opcjonalnie planujemy i implementujemy

- **Roadmap item**: **S-04** | **Rola w lekcji**: system SRS | **Co z nim robimy**: w lekcji o researchu

- **Roadmap item**: **S-05** | **Rola w lekcji**: po etapie MVP | **Co z nim robimy**: zadanie domowe dla chętnych

Podział projektu na etapy pomaga oceniać postęp po każdym kroku. Przy tym podziale łatwo wpaść w jedną z dwóch skrajności.

Pierwsza to vibe coding: „zróbmy wszystko, co jest w roadmapie”. Zwykle kończy się to dużym diffem, w którym trudno oddzielić dobry postęp od przypadkowych decyzji agenta.

Druga: „przed każdym krokiem zróbmy dokładnie ten sam rytuał - pięć kroków przygotowania, osiem researchu, dwanaście plików markdown, a potem dopiero kodujemy”. Brzmi to dojrzale, ale szybko zamienia workflow w sztukę dla sztuki. Przestajesz wtedy pytać, po co właściwie wykonujesz dany krok.

W tej lekcji uczymy się podejścia pośredniego: wybieramy te slice'y, które w miarę dobrze rozumiemy, planujemy ich implementację, w razie potrzeby korygujemy plan i ruszamy do pracy.

### Change-id jako intencja pracy

Żeby precyzyjnie rozmawiać o zmianie, nadajemy jej **change-id**: jedną nazwę opisującą, co zamierzamy zrobić.

Przykłady:

```
gate-product-routes
first-gated-generation
atomic-save-to-deck
```

Pod jednym **change-id** łączymy:

- pozycję z roadmapy,

- folder **context/changes/\<change-id>/**,

- opis zmiany w **change.md**,

- plan implementacji w **plan.md**,

- skrót planu w **plan-brief.md**,

- późniejszą komendę **/10x-implement \<change-id> phase 1**,

- sekcję **## Progress**, w której zapisujemy faktyczny stan pracy.

**change-id** ma odpowiedzieć na pytanie: „o której konkretnej zmianie rozmawiamy i gdzie jest jej pamięć?”.

![Obraz 2](https://images.przeprogramowani.pl/diagrams/lessons-m2-l2-lesson-draft-2-10x.png)

Tak stosujemy strategię **Write** z preworku o context engineeringu: zapisujemy ustalenia w repozytorium, żeby móc do nich wrócić po zakończeniu rozmowy z agentem.

### Skąd się wziął ten workflow

Workflow **research -> plan -> implement** powstał z naszych obserwacji pracy agenta w realnym kodzie, testowania konfiguracji narzędzi i wymiany uwag o tym, co nam nie pasuje albo czego brakuje.

Chcemy ocenić plan przed kodowaniem. No dobra, bierzemy więc wbudowany Plan Mode. Działa, ale po swojemu. Jeśli plan zostaje tylko w sesji, trudno wrócić do niego za tydzień albo przekazać go innej osobie. Mamy też ograniczony wpływ na jego strukturę.

Robimy więc **/10x-plan**: plan ma trafiać do repo, ma mieć stałą strukturę i ma być czytelny zarówno dla człowieka, jak i dla **/10x-implement**.

Mamy plan, obserwujemy implementację i widzimy, że agent robi za dużo naraz. Trudno ocenić jego pracę w trakcie. Chcemy wykonywać ją krokowo i zapisywać postęp, więc robimy **/10x-implement**. Dodajemy etap testów automatycznych i manualnych, commit po każdej fazie i aktualizację **## Progress** jako trwały ślad pracy.

Tę wersję workflow możesz teraz sprawdzić u siebie. Twoje narzędzia, twój zespół i twój projekt mają swoją specyfikę. Coś w naszym workflow może ci nie pasować, czegoś może brakować. Traktuj **/10x-plan**, **/10x-plan-review** i **/10x-implement** jak punkt wyjścia, a nie ostateczną konfigurację.

Zobaczmy teraz cały proces w akcji.

### F-01 jako fundament techniczny

W naszym projekcie roadmapa zaczyna się od **F-01 gate-product-routes**.

To dobry przykład zadania, które nie wymaga osobnego researchu ani framingu. Zakres jest jasny: produktowe ścieżki mają być dostępne dopiero za bramką uwierzytelniania, a agent powinien ustalić, których plików dotknąć i jak zweryfikować zmianę.

Cykl pracy z takim zadaniem opiera się na trzech głównych skillach:

- **10x-new** do założenia nowej zmiany (change-id),

- **10x-plan** do utworzenia **plan.md** oraz **plan-brief.md**,

- **10x-implement** do rozpoczęcia krokowej realizacji zadania.

```
/10x-new gate-product-routes F-01 z @roadmap.md
/10x-plan gate-product-routes
/10x-implement gate-product-routes phase 1
```

To podstawowy workflow dla zadań o niskiej i średniej złożoności, w których spodziewamy się, że agent poradzi sobie bez większego wsparcia.

### S-01 i S-02 jako pierwsze slice'y funkcjonalne

Po rozgrzewce przechodzimy do właściwego slice'a: **S-01 first-gated-generation**, a dalej **S-02 atomic-save-to-deck**.

Przygotujemy plan dla **S-02** za pomocą **10x-plan**. Pełen przebieg zobaczysz poniżej na filmie.

Wywołanie skilla:

```
/10x-plan atomic-save-to-deck
```

Plan powinien dzielić pracę na fazy, które da się wykonać i zweryfikować osobno. Każda faza potrzebuje własnego kontraktu; jedna faza pod tytułem „implement everything” nie daje takiej kontroli. W workflow 10xDevs narzucamy ten podział strukturą planu.

Skill tworzy dwa artefakty. Dodaliśmy skrót planu, gdy zobaczyliśmy, jak trudno ocenić długi dokument.

Pierwszy artefakt to **plan.md**, który powinien zawierać przynajmniej:

- **end state** - co ma być prawdą po zmianie,

- **phases** - logiczne kroki wykonania,

- **Intent + Contract per file** - po co dotykamy danego pliku i jakiego kontraktu nie wolno złamać,

- **Success Criteria** - jak poznamy, że działa,

- **Risks / Open Questions** - co nadal może zablokować pracę,

- **## Progress** - jedno miejsce, w którym implementacja zapisuje status faz.

Drugi artefakt, **plan-brief.md**, pozwala szybko ocenić zakres zmiany, potwierdzić lub skorygować kierunek i przekazać kontekst osobom, które będą robić review.

Przebieg planowania:

![Obraz 3](https://images.przeprogramowani.pl/diagrams/lessons-m2-l2-lesson-draft-3-10x.png)

Zobaczmy to w akcji:

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1193153481" title="Odtwarzacz wideo Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>

### Plan review przed kodem

Jeśli chcesz oddelegować agentowi więcej pracy na etapie przygotowań, mamy do tego jeszcze jeden skill.

```
/10x-plan-review atomic-save-to-deck
```

Za pomocą **/10x-plan-review** sprawdzamy gotowość planu do implementacji:

- Czy plan naprawdę odpowiada na zadanie z roadmapy?

- Czy end state jest konkretny?

- Czy fazy są wykonalne i nie przeskakują ważnych decyzji?

- Czy powierzchnie kontraktu są nazwane?

- Czy **## Progress** ma format, który **/10x-implement** będzie potrafił aktualizować?

- Czy success criteria sprawdzają zachowanie, a nie tylko istnienie plików?

Jeśli agent zgłosi istotne uwagi podczas review, popraw plan przed implementacją. Na tym etapie poprawka kosztuje kilka minut i trochę tokenów. Odkręcanie błędnych zmian w kilkunastu plikach wymaga dużo więcej pracy.

Po review możesz zatwierdzić plan, zanim agent zacznie modyfikować repozytorium.

### Implementacja jednej fazy

Po zaakceptowaniu planu możesz uruchomić implementację:

```
/10x-implement atomic-save-to-deck phase 1
```

Agent ma wykonać konkretną fazę z **plan.md**, zweryfikować wynik, poprosić cię o potwierdzenie tam, gdzie jest potrzebne, zrobić commit i zaktualizować **## Progress**.

Przebieg jednej fazy:

![Obraz 4](https://images.przeprogramowani.pl/diagrams/lessons-m2-l2-lesson-draft-4-10x.png)

Na razie wystarczy, że zobaczysz mechanikę:

- agent trzyma się jednej fazy,

- raportuje zmodyfikowane pliki,

- uruchamia ustalone komendy weryfikacji,

- zatrzymuje się na manual gate, jeśli plan tego wymaga,

- zapisuje commit SHA albo status w **## Progress**.

Do oceny kontekstu i radzenia sobie z halucynacjami wrócimy przy researchu dotyczącym trudniejszego streamu SRS. Tutaj ćwiczymy wykonanie planu faza po fazie.

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1193154861" title="Odtwarzacz wideo Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>

### Domknięcie zmiany z /10x-archive

Po zakończeniu wszystkich faz i weryfikacji wyniku możesz zamknąć zmianę za pomocą **/10x-archive**:

```
/10x-archive atomic-save-to-deck
```

Skill przenosi cały folder z **context/changes/\<change-id>/** do **context/archive/\<data-utworzenia>-\<change-id>/** i zapisuje w **change.md** status **archived** oraz datę archiwizacji. Jeśli w roadmapie znajdzie pozycję z tym samym **Change ID**, oznacza ją jako **done** i dodaje wpis w sekcji **Done**. Archiwizację zapisuje w lokalnym commicie; push pozostaje po twojej stronie.

Skill wprowadza też dodatkowe bramki bezpieczeństwa. Przed archiwizacją agent ostrzega między innymi o niewykonanych punktach planu i brakującym review, pozostawiając ci decyzję o kontynuowaniu pracy. Niezacommitowane zmiany w folderze oraz wcześniej przygotowane zmiany w stagingu blokują operację. Ostatecznie to ty podejmujesz decyzję o archiwizacji, ale ostrzeżenia pozwalają ci to zrobić bardziej świadomie.

Nie każda zmiana musi od razu trafić do archiwum. Czasem chcesz zostawić jej kontekst bardziej „na wierzchu”, bo zaraz wykorzystasz go w kolejnym zadaniu. Sam wybierz moment archiwizacji, ale porządkuj **context/changes/**, żeby nie gromadzić tam dawno zakończonych prac.

Gdy uznasz zmianę za zamkniętą, zarchiwizuj jej dokumentację jako `immutable context`, czyli niezmienny punkt odniesienia. Kolejne zadanie otwórz przez **/10x-new** i wskaż archiwalny folder jako kontekst. Możesz wtedy korzystać z wcześniejszych decyzji, zachowując ich pierwotny zapis.

To będzie również użyteczny ślad dla osób, które dołączą do projektu na dalszym etapie prac.

Załóżmy, że walczymy o istotną biznesową zmianę, np. zwiększenie liczby osób, które zapisują pierwszą talię fiszek. Wdrażamy pomysł A, ale po czasie nie widzimy oczekiwanego efektu. Zapisujemy wynik i wnioski, zamykamy zmianę, a przy planowaniu pomysłu B odwołujemy się do dokumentacji A. B też nie daje efektu, więc przy podejściu C korzystamy już z wniosków z obu prób. Tym razem wynik się poprawia, a w dokumentacji zapisujemy, które wcześniejsze ustalenia wykorzystaliśmy i co zmieniliśmy.

Do zespołu dołącza nowa osoba. Z dokumentacji pomysłu C może przejść do niewypałów, czyli pomysłów A i B, sprawdzić, czego próbowaliśmy i dlaczego wybraliśmy obecne rozwiązanie. Ma szansę uniknąć powtórzenia pomysłu, który już sprawdziliśmy, albo świadomie wrócić do niego, jeśli zmieniły się warunki. Taka ciągłość wymaga zapisania wyników i wniosków oraz odwołań do wcześniejszych zmian.


### Checkpoint postępu

Po tej lekcji masz:

- wybrany stream z roadmapy,

- change folder dla konkretnej zmiany,

- **plan.md** i **plan-brief.md**,

- plan po szybkim review,

- przynajmniej jedną fazę zaimplementowaną albo gotowy checkpoint pokazujący, jak faza wygląda po wykonaniu,

- zaktualizowaną sekcję **## Progress**.

## 🧑🏻‍💻 Zadania praktyczne

- **Zaplanuj jeden slice z roadmapy.** Wybierz z **context/foundation/roadmap.md** foundation lub mały slice na rozgrzewkę. Uruchom **/10x-plan \<change-id>**. Cel: plan implementacji wybranej zmiany z podziałem na fazy.

- **Zaimplementuj wybrany slice.** Odpal **/10x-implement \<change-id>**. W trakcie pracy obserwuj, jak agent trzyma się danej fazy, czy raportuje modyfikowane pliki, uruchamia komendy weryfikacji i zatrzymuje się na testach ręcznych. Cel: jeden slice roadmapy domknięty zgodnie z planem.

Jeśli z powodzeniem przetestujesz cykl **plan -> implement**, dodaj do niego kolejne elementy z lekcji modułu drugiego i spróbuj w tym tygodniu domknąć kluczowe obszary swojego MVP. Pamiętaj o North Star, czyli jednym kluczowym aspekcie, który decyduje o wartości projektu. Reszta powinna poczekać na swoją kolej. Pracuj swoim tempem i zostaw sobie czas na ocenę planu i review kodu.

## Odbierz swoją odznakę

Po ukończeniu tej lekcji odbierz odznakę w sekcji [10xDevs Mission Log](https://platforma.przeprogramowani.pl/mission-log), a następnie pochwal się swoim osiągnięciem!

## Deep Dive

### Dlaczego plan nie jest biurokracją

Planowanie ma złą reputację, bo wielu z nas kojarzy je z dokumentem, który powstaje przed pracą, a potem nikt do niego nie wraca.

W pracy z agentem wracasz do planu, żeby uzgodnić zakres i kolejność zmian przed edycją plików.

Agent potrafi szybko przeczytać repo, zaproponować kolejność, wskazać pliki i zbudować mentalny model zmiany. Problem w tym, że jeśli zrobi to tylko „w głowie” w ramach sesji, ty widzisz efekt dopiero w diffie. A diff po kilku minutach autonomicznej pracy może być już zbyt szeroki, żeby wygodnie ocenić, gdzie zaczęło się odchylenie (tzw. drift).

Dzięki **plan.md** możesz ocenić zamiary agenta przed implementacją (shift-left).

Zamiast pytać po fakcie („dlaczego zmieniłeś te pliki?”), pytasz wcześniej („czy te pliki naprawdę są w zakresie zadania?”). Zamiast odkrywać po implementacji, że agent zinterpretował **S-02** jako przebudowę całego modelu kart, łapiesz to na etapie planowania.

Cursor opisuje Plan Mode jako tryb, w którym agent najpierw bada kod, zadaje pytania i tworzy plan do review przed implementacją. Claude Code dokumentuje podobny workflow „plan before editing” i jednocześnie ostrzega, że planowanie ma swój koszt. OpenAI w materiałach o Codexie i planach wykonawczych również podkreśla wartość samowystarczalnych planów przy dłuższych zadaniach.

Im większe ryzyko i im więcej plików obejmuje zmiana, tym bardziej przydaje się czytelny plan przed kodowaniem.

### Plan Mode a **/10x-plan**

Wbudowany Plan Mode i **/10x-plan** pomagają zaplanować pracę, ale różnią się sposobem przechowywania i wykorzystania planu.

- **Cecha**: Gdzie żyje plan | **Wbudowany Plan Mode**: w UI narzędzia albo w rozmowie | **/10x-plan w 10xWorkflow**: w **context/changes/\<change-id>/plan.md**

- **Cecha**: Jak długo żyje | **Wbudowany Plan Mode**: zależnie od sesji | **/10x-plan w 10xWorkflow**: tak długo, jak repo

- **Cecha**: Do czego służy | **Wbudowany Plan Mode**: kontrola przed edycją | **/10x-plan w 10xWorkflow**: kontrola, hand-off, implementacja, review

- **Cecha**: Jak wznowić pracę | **Wbudowany Plan Mode**: przez historię narzędzia | **/10x-plan w 10xWorkflow**: przez pliki: **change.md**, **plan.md**, **plan-brief.md**, **## Progress**

- **Cecha**: Jak łączy się z roadmapą | **Wbudowany Plan Mode**: ręcznie, przez prompt | **/10x-plan w 10xWorkflow**: przez change-id i folder zmiany

Możesz korzystać z wbudowanego Plan Mode i zapisywać końcowe ustalenia w repozytorium, zgodnie z 10xWorkflow.

### Architekt i koder

Coraz częściej narzędzia agentowe rozdzielają role modelu: mocniejszy model do planowania, tańszy albo szybszy do wykonania planu. Przykładem jest konfiguracja [**opusplan** w Claude Code](https://code.claude.com/docs/en/model-config). Planowanie wymaga mocniejszego rozumowania, a wykonanie części zmian może być bardziej rutynowe.

Nie traktuj tego jak obowiązkowej konfiguracji. Nazwy modeli, ceny i domyślne ustawienia zmieniają się zbyt szybko, żeby budować na nich metodę kursu.

Traktuj to jako model mentalny:

- **architekt** ustala zakres, ryzyka, kontrakty i fazy,

- **koder** wykonuje fazę zgodnie z planem,

- **człowiek** zatwierdza kierunek i pilnuje, czy plan nadal odpowiada produktowi.

W prostych zadaniach te role mogą zmieścić się w jednej sesji i jednym modelu. W trudniejszych możesz świadomie rozdzielić planowanie i implementację: osobny wątek, mocniejszy model, subagent do researchu albo ręczne review planu.

Przed kodowaniem zapisz plan, który możesz przeczytać i zatwierdzić niezależnie od wybranego modelu.

### Co robić z **Unknowns**

Roadmapa często zawiera **Unknowns**, **Blockers** i **Risk**. Przed planowaniem ustal, które z nich wpływają na bieżące zadanie.

Część niewiadomych agent może rozstrzygnąć podczas **/10x-plan**, czytając kod. Jeśli roadmapa mówi „nie wiadomo, czy istnieje już komponent formularza”, agent może to sprawdzić w repo. Jeśli roadmapa mówi „nie wiadomo, czy biblioteka SRS obsługuje wymaganą skalę ocen”, to prawdopodobnie potrzebujesz osobnego researchu, bo to nie jest lokalne pytanie o kod.

Praktyczna reguła:

- **lokalne unknowns** - pozwól **/10x-plan** je rozstrzygnąć,

- **zewnętrzne unknowns** - sięgnij po research, jeśli wpływają na decyzję techniczną,

- **podejrzane założenia** - użyj framingu, jeśli nie masz pewności, czy problem jest dobrze postawiony,

- **unknowns bez wpływu na obecny slice** - zostaw w **Open Questions** albo **Parked**.

Rób research wtedy, gdy potrzebujesz jego wyników do podjęcia decyzji o bieżącej zmianie.

### Kiedy zatrzymać implementację

Jeśli w trakcie fazy agent odkryje fakt, który zmienia kontrakt planu, zatrzymaj implementację.

Przykłady:

- plan zakładał istniejący model **Deck**, ale w repo nie ma nic podobnego,

- plan zakładał jedną ścieżkę auth, a projekt ma dwie niespójne ścieżki,

- plan zakładał prosty zapis kart, ale walidacja domenowa wymaga decyzji produktowej,

- plan zakładał dotknięcie trzech plików, a agent chce przebudować dziesięć modułów.

Drobne rozbieżności, takie jak literówka w nazwie pliku, inny eksport czy mała różnica w strukturze komponentu, możesz uwzględnić podczas pracy.

Ale jeśli zmienia się end state albo powierzchnia kontraktu, nie „dokręcaj” kodu kolejnym promptem. Wróć do planu, popraw go i dopiero wtedy kontynuuj.

W lekcji czwartej pogłębimy ten temat na przykładzie SRS, gdzie drift może wynikać z braku świeżej dokumentacji biblioteki. Każdą zmianę ustaleń zapisuj w planie, żeby było jasne, według której wersji pracujesz.

## Materiały Dodatkowe

- **Introducing Plan Mode** / Cursor / <https://cursor.com/blog/plan-mode> - przykład produktowego Plan Mode: research kodu, pytania doprecyzowujące i plan przed implementacją.

- **Best practices for Claude Code** / Anthropic / <https://code.claude.com/docs/en/best-practices> - dobre źródło dla zasady, że planowanie pomaga przy niepewnych i wieloplikowych zmianach, ale wymaga dodatkowego czasu i tokenów.

- **Common workflows** / Anthropic / <https://code.claude.com/docs/en/common-workflows> - opis workflowu planowania przed edycją i oddzielania researchu od implementacji.

- **Model configuration** / Anthropic / <https://code.claude.com/docs/en/model-config> - kontekst dla wzorca architekt/koder; traktuj jako przykład roli modelu, nie stałą rekomendację konkretnej konfiguracji.

- **Exec Plans for Complex Coding Tasks** / OpenAI Cookbook / <https://developers.openai.com/cookbook/articles/codex_exec_plans> - szersze uzasadnienie dla samowystarczalnych planów jako artefaktów pracy przy dłuższych zadaniach.

- **How OpenAI uses Codex** / OpenAI / <https://cdn.openai.com/pdf/6a2631dc-783e-479b-b1a4-af0cfbd38630/how-openai-uses-codex.pdf> - praktyczne wskazówki o pracy ze strukturą, kontekstem, zadaniami podobnymi do issue i planem przed większą implementacją.
