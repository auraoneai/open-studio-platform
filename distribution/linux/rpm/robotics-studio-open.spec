Name: robotics-studio-open
Version: 0.2.0
Release: 1%{?dist}
Summary: Local-first IDE for reviewed teleop and VLA datasets
License: MIT
URL: https://robotics-studio.auraone.ai/
Source0: %{name}-%{version}.tar.gz

Requires: webkit2gtk4.1
Requires: libappindicator-gtk3
Requires: librsvg2
Requires: ca-certificates

%description
Robotics Studio Open reviews robotics episodes locally, scrubs synchronized
sensor streams, clusters failures, probes policies, and exports explicit
manifests for local disk, Hugging Face, or intake.

%prep
%autosetup

%build

%install
mkdir -p %{buildroot}%{_bindir}
mkdir -p %{buildroot}%{_datadir}/applications
mkdir -p %{buildroot}%{_datadir}/metainfo
install -m 0755 robostudio %{buildroot}%{_bindir}/robostudio
install -m 0644 robotics-studio-open.desktop %{buildroot}%{_datadir}/applications/robotics-studio-open.desktop
install -m 0644 ai.auraone.roboticsstudio.metainfo.xml %{buildroot}%{_datadir}/metainfo/ai.auraone.roboticsstudio.metainfo.xml

%files
%license LICENSE
%doc README.md
%{_bindir}/robostudio
%{_datadir}/applications/robotics-studio-open.desktop
%{_datadir}/metainfo/ai.auraone.roboticsstudio.metainfo.xml

%changelog
* Sun Jul 12 2026 AuraOne Open Studio <opensource@auraone.ai> - 0.2.0-1
- Stage Proofline UI/UX package metadata; artifacts and signatures remain blocked.

* Tue May 19 2026 AuraOne Open Studio <opensource@auraone.ai> - 0.1.0-1
- Initial Robotics Studio Open package metadata.
