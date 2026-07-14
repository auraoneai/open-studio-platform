Name: rubric-studio-open
Version: 0.2.0
Release: 1%{?dist}
Summary: Local-first IDE for authoring and testing evaluation rubrics
License: MIT
URL: https://rubric-studio.auraone.ai/
Source0: %{name}-%{version}.tar.gz

Requires: webkit2gtk4.1
Requires: libappindicator-gtk3
Requires: librsvg2
Requires: ca-certificates

%description
Rubric Studio Open authors, tests, calibrates, diffs, and exports
criterion-level AI evaluation rubrics locally. It keeps rubric files git-native,
uses BYO provider keys, and uses opt-in telemetry only.

%prep
%autosetup

%build

%install
mkdir -p %{buildroot}%{_bindir}
mkdir -p %{buildroot}%{_datadir}/applications
mkdir -p %{buildroot}%{_datadir}/metainfo
install -m 0755 rubricstudio %{buildroot}%{_bindir}/rubricstudio
install -m 0644 rubric-studio-open.desktop %{buildroot}%{_datadir}/applications/rubric-studio-open.desktop
install -m 0644 ai.auraone.rubricstudio.metainfo.xml %{buildroot}%{_datadir}/metainfo/ai.auraone.rubricstudio.metainfo.xml

%files
%license LICENSE
%doc README.md
%{_bindir}/rubricstudio
%{_datadir}/applications/rubric-studio-open.desktop
%{_datadir}/metainfo/ai.auraone.rubricstudio.metainfo.xml

%changelog
* Sun Jul 12 2026 AuraOne Open Studio <opensource@auraone.ai> - 0.2.0-1
- Stage Proofline UI/UX package metadata; artifacts and signatures remain blocked.

* Tue May 19 2026 AuraOne Open Studio <opensource@auraone.ai> - 0.1.0-1
- Initial Rubric Studio Open package metadata.
