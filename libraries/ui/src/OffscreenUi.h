//
//  OffscreenUi.h
//  interface/src/entities
//
//  Created by Bradley Austin Davis on 2015-04-04
//  Copyright 2015 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
#pragma once
#ifndef hifi_OffscreenUi_h
#define hifi_OffscreenUi_h

#include <QtCore/QVariant>
#include <QtWidgets/QFileDialog>
#include <QtWidgets/QMessageBox>
#include <QtWidgets/QInputDialog>

#include <gl/OffscreenQmlSurface.h>
#include <DependencyManager.h>

#include "OffscreenQmlElement.h"


class OffscreenUi : public OffscreenQmlSurface, public Dependency {
    Q_OBJECT

public:
    OffscreenUi();
    virtual void create(QOpenGLContext* context) override;
    void createDesktop(const QUrl& url);
    void show(const QUrl& url, const QString& name, std::function<void(QQmlContext*, QObject*)> f = [](QQmlContext*, QObject*) {});
    void toggle(const QUrl& url, const QString& name, std::function<void(QQmlContext*, QObject*)> f = [](QQmlContext*, QObject*) {});
    bool shouldSwallowShortcut(QEvent* event);
    bool navigationFocused();
    void setNavigationFocused(bool focused);
    void unfocusWindows();
    void toggleMenu(const QPoint& screenCoordinates);

    QQuickItem* getDesktop();
    QQuickItem* getToolWindow();


    // Message box compatibility
    Q_INVOKABLE QMessageBox::StandardButton messageBox(QMessageBox::Icon icon, const QString& title, const QString& text, QMessageBox::StandardButtons buttons, QMessageBox::StandardButton defaultButton);
    // Must be called from the main thread
    QQuickItem* createMessageBox(QMessageBox::Icon icon, const QString& title, const QString& text, QMessageBox::StandardButtons buttons, QMessageBox::StandardButton defaultButton);
    // Must be called from the main thread
    Q_INVOKABLE int waitForMessageBoxResult(QQuickItem* messageBox);

    /// Same design as QMessageBox::critical(), will block, returns result
    static QMessageBox::StandardButton critical(void* ignored, const QString& title, const QString& text,
        QMessageBox::StandardButtons buttons = QMessageBox::Ok,
        QMessageBox::StandardButton defaultButton = QMessageBox::NoButton) {
        return critical(title, text, buttons, defaultButton);
    }
    /// Same design as QMessageBox::information(), will block, returns result
    static QMessageBox::StandardButton information(void* ignored, const QString& title, const QString& text,
        QMessageBox::StandardButtons buttons = QMessageBox::Ok,
        QMessageBox::StandardButton defaultButton = QMessageBox::NoButton) {
        return information(title, text, buttons, defaultButton);
    }
    /// Same design as QMessageBox::question(), will block, returns result
    static QMessageBox::StandardButton question(void* ignored, const QString& title, const QString& text,
        QMessageBox::StandardButtons buttons = QMessageBox::Ok,
        QMessageBox::StandardButton defaultButton = QMessageBox::NoButton) {
        return question(title, text, buttons, defaultButton);
    }
    /// Same design as QMessageBox::warning(), will block, returns result
    static QMessageBox::StandardButton warning(void* ignored, const QString& title, const QString& text,
        QMessageBox::StandardButtons buttons = QMessageBox::Ok,
        QMessageBox::StandardButton defaultButton = QMessageBox::NoButton) {
        return warning(title, text, buttons, defaultButton);
    }

    static QMessageBox::StandardButton critical(const QString& title, const QString& text,
        QMessageBox::StandardButtons buttons = QMessageBox::Ok,
        QMessageBox::StandardButton defaultButton = QMessageBox::NoButton);
    static QMessageBox::StandardButton information(const QString& title, const QString& text,
        QMessageBox::StandardButtons buttons = QMessageBox::Ok,
        QMessageBox::StandardButton defaultButton = QMessageBox::NoButton);
    static QMessageBox::StandardButton question(const QString& title, const QString& text,
        QMessageBox::StandardButtons buttons = QMessageBox::Ok,
        QMessageBox::StandardButton defaultButton = QMessageBox::NoButton);
    static QMessageBox::StandardButton warning(const QString& title, const QString& text,
        QMessageBox::StandardButtons buttons = QMessageBox::Ok,
        QMessageBox::StandardButton defaultButton = QMessageBox::NoButton);

    Q_INVOKABLE QString fileOpenDialog(const QString &caption = QString(), const QString &dir = QString(), const QString &filter = QString(), QString *selectedFilter = 0, QFileDialog::Options options = 0);
    Q_INVOKABLE QString fileSaveDialog(const QString &caption = QString(), const QString &dir = QString(), const QString &filter = QString(), QString *selectedFilter = 0, QFileDialog::Options options = 0);

    // Compatibility with QFileDialog::getOpenFileName
    static QString getOpenFileName(void* ignored, const QString &caption = QString(), const QString &dir = QString(), const QString &filter = QString(), QString *selectedFilter = 0, QFileDialog::Options options = 0);
    // Compatibility with QFileDialog::getSaveFileName
    static QString getSaveFileName(void* ignored, const QString &caption = QString(), const QString &dir = QString(), const QString &filter = QString(), QString *selectedFilter = 0, QFileDialog::Options options = 0);


    // input dialog compatibility
    Q_INVOKABLE QVariant inputDialog(const QString& title, const QString& label = QString(), const QVariant& current = QVariant());
    QQuickItem* createInputDialog(const QString& title, const QString& label, const QVariant& current);
    QVariant waitForInputDialogResult(QQuickItem* inputDialog);

    // Compatibility with QInputDialog::getText
    static QString getText(void* ignored, const QString & title, const QString & label, QLineEdit::EchoMode mode = QLineEdit::Normal, const QString & text = QString(), bool * ok = 0, Qt::WindowFlags flags = 0, Qt::InputMethodHints inputMethodHints = Qt::ImhNone);
    // Compatibility with QInputDialog::getItem
    static QString getItem(void *ignored, const QString & title, const QString & label, const QStringList & items, int current = 0, bool editable = true, bool * ok = 0, Qt::WindowFlags flags = 0, Qt::InputMethodHints inputMethodHints = Qt::ImhNone);

private:
    QString fileDialog(const QVariantMap& properties);

    QQuickItem* _desktop { nullptr };
    QQuickItem* _toolWindow { nullptr };
};

#endif
