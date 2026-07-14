Name: agent-studio-open
Version: 0.2.0
Release: 1%{?dist}
Summary: Local-first IDE for debugging MCP and A2A agents
License: MIT
URL: https://agentstudio.auraone.ai/
Source0: %{name}-%{version}.tar.gz

Requires: webkit2gtk4.1
Requires: libappindicator-gtk3
Requires: librsvg2
Requires: ca-certificates

%description
Agent Studio Open records, replays, compares, and regression-tests MCP and A2A
agent sessions locally. It stores traces on disk, keeps user secrets in the OS
keychain, and uses opt-in telemetry only.

%prep
%autosetup

%build

%install
mkdir -p %{buildroot}%{_bindir}
mkdir -p %{buildroot}%{_datadir}/applications
mkdir -p %{buildroot}%{_datadir}/metainfo
install -m 0755 agentstudio %{buildroot}%{_bindir}/agentstudio
install -m 0644 agent-studio-open.desktop %{buildroot}%{_datadir}/applications/agent-studio-open.desktop
install -m 0644 ai.auraone.agentstudio.metainfo.xml %{buildroot}%{_datadir}/metainfo/ai.auraone.agentstudio.metainfo.xml

%files
%license LICENSE
%doc README.md
%{_bindir}/agentstudio
%{_datadir}/applications/agent-studio-open.desktop
%{_datadir}/metainfo/ai.auraone.agentstudio.metainfo.xml

%changelog
* Sun Jul 12 2026 AuraOne Open Studio <opensource@auraone.ai> - 0.2.0-1
- Stage Proofline UI/UX package metadata; artifacts and signatures remain blocked.

* Fri May 15 2026 AuraOne Open Studio <opensource@auraone.ai> - 0.1.0-1
- Initial Agent Studio Open package metadata.
